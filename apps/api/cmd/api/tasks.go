package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/db"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/garage"
	"github.com/hamid-karimi/coachin/apps/api/internal/config"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
	"github.com/hamid-karimi/coachin/apps/api/internal/transport/httpapi"
)

type migrateAction func(ctx context.Context, m *store.Migrator, logger *slog.Logger) error

var migrateActions = map[string]migrateAction{
	"up": func(ctx context.Context, m *store.Migrator, logger *slog.Logger) error {
		results, err := m.Up(ctx)
		for _, r := range results {
			logger.Info("migration applied", "version", r.Source.Version, "file", r.Source.Path, "duration", r.Duration)
		}
		if err == nil && len(results) == 0 {
			logger.Info("database is up to date")
		}
		return err
	},
	"down": func(ctx context.Context, m *store.Migrator, logger *slog.Logger) error {
		r, err := m.Down(ctx)
		if r != nil {
			logger.Info("migration rolled back", "version", r.Source.Version, "file", r.Source.Path)
		}
		return err
	},
	"status": func(ctx context.Context, m *store.Migrator, _ *slog.Logger) error {
		statuses, err := m.Status(ctx)
		for _, s := range statuses {
			fmt.Printf("%-8s %05d  %s\n", s.State, s.Source.Version, s.Source.Path)
		}
		return err
	},
}

func migrate(ctx context.Context, args []string, logger *slog.Logger) error {
	action := "up"
	if len(args) > 0 {
		action = args[0]
	}
	run, ok := migrateActions[action]
	if !ok {
		return fmt.Errorf("unknown migrate action %q (use up, down, or status)", action)
	}

	url, err := config.LoadMigrate(os.Getenv)
	if err != nil {
		return err
	}
	migrations, err := fs.Sub(db.Migrations, "migrations")
	if err != nil {
		return err
	}
	m, err := store.NewMigrator(ctx, url, migrations)
	if err != nil {
		return err
	}
	defer func() { _ = m.Close() }()
	return run(ctx, m, logger)
}

func storageInit(ctx context.Context, _ []string, logger *slog.Logger) error {
	cfg, err := config.LoadGarage(os.Getenv)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if err := garage.NewBootstrapper(cfg, logger).Run(ctx); err != nil {
		return err
	}
	logger.Info("storage ready", "bucket", cfg.S3.Bucket)
	return nil
}

func printOpenAPI(context.Context, []string, *slog.Logger) error {
	_, api := httpapi.New(httpapi.Deps{})
	out, err := json.MarshalIndent(api.OpenAPI(), "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Println(string(out))
	return err
}

// healthcheck lets Docker probe the distroless image, which has no curl.
func healthcheck(ctx context.Context, _ []string, _ *slog.Logger) error {
	_, port, err := net.SplitHostPort(config.HTTPAddr(os.Getenv))
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	url := "http://127.0.0.1:" + port + httpapi.BasePath + "/healthz"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz returned %d", resp.StatusCode)
	}
	return nil
}
