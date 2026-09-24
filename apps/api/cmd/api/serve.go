package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/ai"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/mail"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/objectstore"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/password"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/watchfile"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/activities"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/config"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
	"github.com/hamid-karimi/coachin/apps/api/internal/transport/httpapi"
)

const shutdownGrace = 15 * time.Second

// serve builds its own logger: the level comes from config, which the
// default logger passed in by main doesn't know yet.
func serve(ctx context.Context, _ []string, _ *slog.Logger) error {
	cfg, err := config.LoadServer(os.Getenv)
	if err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))

	pool, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	authPool, err := store.Open(ctx, cfg.AuthDatabaseURL)
	if err != nil {
		return err
	}
	defer authPool.Close()

	objects := objectstore.New(cfg.S3)

	generator, err := ai.New(ctx, ai.Config{
		ClaudeAPIKey: cfg.AI.ClaudeAPIKey, ClaudeModel: cfg.AI.ClaudeModel,
		GeminiAPIKey: cfg.AI.GeminiAPIKey, GeminiModel: cfg.AI.GeminiModel,
	}, logger)
	if err != nil {
		return err
	}

	authService, err := auth.NewService(
		store.NewAuthStore(authPool),
		password.New(password.DefaultParams),
		mail.NewSMTP(cfg.SMTP),
		auth.DefaultSettings(cfg.BaseURL),
		logger,
	)
	if err != nil {
		return err
	}

	handler, _ := httpapi.New(httpapi.Deps{
		Logger: logger,
		Checks: httpapi.ReadinessChecks{
			"database": pool.Ping,
			"storage":  objects.Ping,
		},
		Auth:             authService,
		Routine:          routine.NewService(store.NewRoutineStore(pool), nil),
		Today:            today.NewService(store.NewTodayStore(pool), nil),
		PlanItems:        training.NewService(store.NewTrainingStore(pool), nil),
		Supplements:      supplements.NewService(store.NewSupplementStore(pool), nil),
		Programs:         training.NewPrograms(store.NewTrainingStore(pool), nil),
		Generation:       training.NewGeneration(store.NewTrainingStore(pool), generator, nil),
		Sessions:         training.NewSessions(store.NewTrainingStore(pool), generator),
		Checkins:         training.NewCheckins(store.NewTrainingStore(pool), generator, nil),
		Activities:       activities.NewService(watchfile.New(nil)),
		Cookies:          httpapi.CookieSettings{Secure: cfg.CookieSecure},
		CommunityEnabled: cfg.CommunityEnabled,
	})

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		// Long enough for an AI generation call plus its fallback (each
		// time-boxed at 80 s in adapters/ai).
		WriteTimeout: 180 * time.Second,
		IdleTimeout:  2 * time.Minute,
	}

	errs := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", cfg.HTTPAddr)
		errs <- server.ListenAndServe()
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errs; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
