// Command import-supabase copies the production Supabase project into a freshly
// migrated CoachIn database, once, at go-live (Phase 7.1; deleted in 7.4):
//
//	import-supabase [-dry-run]
//
// SUPABASE_DATABASE_URL is the Supabase Postgres (direct connection, or a local
// restore of its dump); MIGRATE_DATABASE_URL is our owner role. Set
// SUPABASE_S3_* (Storage → S3 connection) to copy the photos too; S3_* is our
// bucket. Users keep their passwords (bcrypt, rehashed on their next login).
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"slices"
	"syscall"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/objectstore"
	"github.com/hamid-karimi/coachin/apps/api/internal/config"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func main() {
	os.Exit(exitCode())
}

// exitCode runs the import and returns the process exit code, so deferred
// cleanup happens before os.Exit.
func exitCode() int {
	dryRun := flag.Bool("dry-run", false, "copy inside a transaction, report, and roll back")
	flag.Parse()
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, *dryRun, logger); err != nil {
		logger.Error("import failed", "error", err)
		return 1
	}
	return 0
}

func run(ctx context.Context, dryRun bool, logger *slog.Logger) error {
	cfg, err := config.LoadImport(os.Getenv)
	if err != nil {
		return err
	}
	report, err := store.ImportSupabase(ctx, cfg.SourceURL, cfg.TargetURL, dryRun)
	if err != nil {
		return err
	}
	logger.Info("users", "imported", report.Users, "without_password", report.NoPassword)
	tables := make([]string, 0, len(report.Rows))
	for table := range report.Rows {
		tables = append(tables, table)
	}
	slices.Sort(tables)
	for _, table := range tables {
		logger.Info("table", "name", table, "rows", report.Rows[table])
	}
	if len(report.Skipped) > 0 {
		logger.Warn("source tables with no target (not imported)", "tables", report.Skipped)
	}
	logger.Info("check", "profiles_whose_xp_differs_from_ledger", report.XPMismatches, "photos", len(report.PhotoKeys))
	if dryRun {
		logger.Info("dry run: nothing was written")
		return nil
	}
	if cfg.Photos == nil {
		logger.Warn("SUPABASE_S3_ENDPOINT unset: photos were not copied")
		return nil
	}
	return copyPhotos(ctx, cfg.Photos, report.PhotoKeys, logger)
}

// copyPhotos copies each stored object to the same key in our bucket; a missing
// source object is reported, not fatal (its row then shows a broken image).
func copyPhotos(ctx context.Context, cfg *config.ImportPhotos, keys []string, logger *slog.Logger) error {
	source, target := objectstore.New(cfg.Source), objectstore.New(cfg.Target)
	if err := target.Ping(ctx); err != nil {
		return err
	}
	var missing []string
	for i, key := range keys {
		body, _, err := source.Get(ctx, key)
		if err != nil {
			missing = append(missing, key)
			continue
		}
		data, err := io.ReadAll(body)
		_ = body.Close()
		if err != nil {
			return fmt.Errorf("read %s: %w", key, err)
		}
		if err := target.Put(ctx, key, data, "image/jpeg"); err != nil {
			return fmt.Errorf("write %s: %w", key, err)
		}
		if (i+1)%100 == 0 {
			logger.Info("photos", "copied", i+1, "of", len(keys))
		}
	}
	logger.Info("photos copied", "count", len(keys)-len(missing), "missing", len(missing))
	if len(missing) > 0 {
		logger.Warn("missing source objects", "keys", missing)
	}
	return nil
}
