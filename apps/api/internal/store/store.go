// Package store is the only package that talks to Postgres.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Open connects a pool and verifies the database is reachable.
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Migrator applies the embedded goose migrations with the owner role.
type Migrator struct {
	provider *goose.Provider
	db       *sql.DB
	pool     *pgxpool.Pool
}

// NewMigrator connects with the migration (owner) URL.
func NewMigrator(ctx context.Context, url string, migrations fs.FS) (*Migrator, error) {
	pool, err := Open(ctx, url)
	if err != nil {
		return nil, err
	}
	db := stdlib.OpenDBFromPool(pool)
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations)
	if err != nil {
		_ = db.Close()
		pool.Close()
		return nil, fmt.Errorf("load migrations: %w", err)
	}
	return &Migrator{provider: provider, db: db, pool: pool}, nil
}

// Close releases the connection.
func (m *Migrator) Close() error {
	err := m.db.Close()
	m.pool.Close()
	return err
}

// Up applies every pending migration and returns what ran.
func (m *Migrator) Up(ctx context.Context) ([]*goose.MigrationResult, error) {
	return m.provider.Up(ctx)
}

// Down rolls back the most recent migration.
func (m *Migrator) Down(ctx context.Context) (*goose.MigrationResult, error) {
	return m.provider.Down(ctx)
}

// DownTo rolls back every migration after version.
func (m *Migrator) DownTo(ctx context.Context, version int64) ([]*goose.MigrationResult, error) {
	return m.provider.DownTo(ctx, version)
}

// Status lists every migration and whether it is applied.
func (m *Migrator) Status(ctx context.Context) ([]*goose.MigrationStatus, error) {
	return m.provider.Status(ctx)
}
