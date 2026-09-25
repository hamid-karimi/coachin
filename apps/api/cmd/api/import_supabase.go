package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"slices"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/objectstore"
	"github.com/hamid-karimi/coachin/apps/api/internal/config"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// importSupabase copies the production Supabase project into a freshly migrated
// CoachIn database, once, at go-live (Phase 7.1; removed in 7.4):
//
//	api import-supabase [-dry-run]
//
// SUPABASE_DATABASE_URL is the Supabase Postgres (direct connection, or a local
// restore of its dump); MIGRATE_DATABASE_URL is our owner role. Set
// SUPABASE_S3_* (Storage → S3 connection) to copy the photos too; S3_* is our
// bucket. Users keep their passwords (bcrypt, rehashed on their next login).
func importSupabase(ctx context.Context, args []string, logger *slog.Logger) error {
	flags := flag.NewFlagSet("import-supabase", flag.ContinueOnError)
	dryRun := flags.Bool("dry-run", false, "copy inside a transaction, report, and roll back")
	if err := flags.Parse(args); err != nil {
		return err
	}
	cfg, err := config.LoadImport(os.Getenv)
	if err != nil {
		return err
	}
	report, err := store.ImportSupabase(ctx, cfg.SourceURL, cfg.TargetURL, *dryRun)
	if err != nil {
		return err
	}
	logImport(report, logger)
	if *dryRun {
		logger.Info("dry run: nothing was written")
		return nil
	}
	if cfg.Photos == nil {
		logger.Warn("SUPABASE_S3_ENDPOINT unset: photos were not copied")
		return nil
	}
	return copyPhotos(ctx, cfg.Photos, report.PhotoKeys, logger)
}

func logImport(report store.ImportReport, logger *slog.Logger) {
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
