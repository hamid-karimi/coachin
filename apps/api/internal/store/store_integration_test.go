package store_test

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/hamid-karimi/coachin/apps/api/db"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// postgresImage matches compose.yaml; override with TEST_POSTGRES_IMAGE (e.g.
// a registry mirror) when Docker Hub rate-limits.
func postgresImage() string {
	if img := os.Getenv("TEST_POSTGRES_IMAGE"); img != "" {
		return img
	}
	return "postgres:18.6-alpine"
}

// dbURLs are connection strings for each database role.
type dbURLs struct{ Owner, App, Auth string }

// startPostgres boots the same image and init script as the compose stack and
// returns a connection string per role.
func startPostgres(t *testing.T) dbURLs {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test: needs Docker")
	}
	ctx := context.Background()

	initScript, err := filepath.Abs("../../../../deploy/postgres/initdb/01-app-role.sh")
	if err != nil {
		t.Fatal(err)
	}

	container, err := postgres.Run(ctx, postgresImage(),
		postgres.WithDatabase("coachin"),
		postgres.WithUsername("coachin_owner"),
		postgres.WithPassword("owner-pw"),
		postgres.WithInitScripts(initScript),
		testcontainers.WithEnv(map[string]string{"APP_DB_PASSWORD": "app-pw", "AUTH_DB_PASSWORD": "auth-pw"}),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(60*time.Second)),
	)
	testcontainers.CleanupContainer(t, container)
	if err != nil {
		t.Fatalf("start postgres: %v", err)
	}

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatal(err)
	}
	port, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		t.Fatal(err)
	}
	base := "@" + host + ":" + port.Port() + "/coachin?sslmode=disable"
	return dbURLs{
		Owner: "postgres://coachin_owner:owner-pw" + base,
		App:   "postgres://coachin_app:app-pw" + base,
		Auth:  "postgres://coachin_auth:auth-pw" + base,
	}
}

func migrations(t *testing.T) fs.FS {
	t.Helper()
	sub, err := fs.Sub(db.Migrations, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	return sub
}

func TestMigrationsApplyAndRollBack(t *testing.T) {
	urls := startPostgres(t)
	ownerURL, appURL := urls.Owner, urls.App
	ctx := context.Background()

	m, err := store.NewMigrator(ctx, ownerURL, migrations(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = m.Close() }()

	if _, err := m.Up(ctx); err != nil {
		t.Fatalf("up: %v", err)
	}

	// The API role can use the user-context function and is not an owner
	// (owners bypass row-level security).
	conn, err := pgx.Connect(ctx, appURL)
	if err != nil {
		t.Fatalf("connect as app role: %v", err)
	}
	defer func() { _ = conn.Close(ctx) }()

	var unset *string
	if err := conn.QueryRow(ctx, "SELECT app.current_user_id()::text").Scan(&unset); err != nil {
		t.Fatalf("current_user_id without context: %v", err)
	}
	if unset != nil {
		t.Errorf("current_user_id() = %q without context, want NULL", *unset)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	const uid = "0b6f6f3e-6c1a-4f1e-9a53-2a1f1c1d2e3f"
	var got string
	err = tx.QueryRow(ctx,
		"SELECT set_config('app.user_id', $1, true), app.current_user_id()::text", uid,
	).Scan(new(string), &got)
	if err != nil || got != uid {
		t.Fatalf("current_user_id() = %q, %v; want %s", got, err, uid)
	}
	_ = tx.Rollback(ctx)

	var bypassesRLS bool
	if err := conn.QueryRow(ctx,
		"SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user",
	).Scan(&bypassesRLS); err != nil {
		t.Fatal(err)
	}
	if bypassesRLS {
		t.Error("coachin_app must not bypass row-level security")
	}

	if _, err := m.Down(ctx); err != nil {
		t.Fatalf("down: %v", err)
	}
	if _, err := m.Up(ctx); err != nil {
		t.Fatalf("re-up after down: %v", err)
	}
}
