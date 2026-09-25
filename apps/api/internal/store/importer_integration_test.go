package store_test

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// Phase 7.1: a Supabase-shaped source (the public schema + auth.users) is copied
// into a fresh target; imported users sign in with their Supabase passwords.
func TestImportSupabase(t *testing.T) {
	svc, _, urls := newAuthService(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()

	// The source: a second database on the same server with the same public
	// schema, plus Supabase's auth.users.
	if _, err := owner.Exec(ctx, `CREATE DATABASE supabase`); err != nil {
		t.Fatal(err)
	}
	sourceURL := strings.Replace(urls.Owner, "/coachin?", "/supabase?", 1)
	m, err := store.NewMigrator(ctx, sourceURL, migrations(t))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.DownTo(ctx, 8); err != nil { // legacy data predates the once-only index
		t.Fatal(err)
	}
	if _, err := m.Up(ctx); err != nil {
		t.Fatal(err)
	}
	_ = m.Close()
	src, err := pgx.Connect(ctx, sourceURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = src.Close(ctx) }()
	hash, err := bcrypt.GenerateFromPassword([]byte("Supabase-pw1"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	const ada, bob = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"
	for _, stmt := range []string{
		`SET session_replication_role = replica`,
		`DROP INDEX public.xp_transactions_once_idx`, // Supabase has none
		`CREATE SCHEMA auth`,
		`CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text, email_confirmed_at timestamptz,
			created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
		`INSERT INTO auth.users VALUES
			('` + ada + `', 'ada@example.com', '` + string(hash) + `', now(), now() - interval '90 days', now(), NULL),
			('` + bob + `', 'bob@example.com', '', NULL, now(), now(), NULL),
			('33333333-3333-3333-3333-333333333333', 'gone@example.com', 'x', now(), now(), now(), now())`,
		`INSERT INTO profiles (id, email, full_name, xp, role) VALUES
			('` + ada + `', 'ada@example.com', 'Ada', 125, 'student'), ('` + bob + `', 'bob@example.com', 'Bob', 0, 'coach')`,
		`INSERT INTO xp_transactions (user_id, amount, reason) VALUES
			('` + ada + `', 60, 'workout_log:1'), ('` + ada + `', 60, 'workout_log:1'), ('` + ada + `', 5, 'meal_log:m1'), ('` + ada + `', 0, 'meal_log:m1')`,
		`INSERT INTO body_photos (user_id, storage_path, kind) VALUES ('` + ada + `', '` + ada + `/p1.jpg', 'progress')`,
		`INSERT INTO sport_types (name, xp_multiplier) VALUES ('Parkour', 1.3)`,
		`ALTER TABLE public.logs ADD COLUMN legacy_only text`, // extra source columns are ignored
		`CREATE TABLE public.legacy_audit (id int)`,           // source-only tables are reported
	} {
		if _, err := src.Exec(ctx, stmt); err != nil {
			t.Fatalf("%s: %v", stmt, err)
		}
	}

	// A dry run changes nothing.
	dry, err := store.ImportSupabase(ctx, sourceURL, urls.Owner, true)
	if err != nil {
		t.Fatalf("dry run: %v", err)
	}
	var users int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&users)
	if dry.Users != 2 || users != 0 {
		t.Fatalf("dry run: report %d users, target has %d", dry.Users, users)
	}

	report, err := store.ImportSupabase(ctx, sourceURL, urls.Owner, false)
	if err != nil {
		t.Fatal(err)
	}
	if report.Users != 2 || report.NoPassword != 1 || report.Rows["profiles"] != 2 || report.Rows["xp_transactions"] != 4 {
		t.Fatalf("report = %+v", report)
	}
	if !slices.Contains(report.Skipped, "legacy_audit") || len(report.PhotoKeys) != 1 || report.PhotoKeys[0] != ada+"/p1.jpg" {
		t.Fatalf("skipped %v, photos %v", report.Skipped, report.PhotoKeys)
	}
	if report.XPMismatches != 0 {
		t.Fatalf("%d profiles disagree with their ledger", report.XPMismatches)
	}
	var reasons []string
	rows, _ := owner.Query(ctx, `SELECT reason FROM xp_transactions ORDER BY reason`)
	reasons, err = pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil || !slices.Equal(reasons, []string{"meal_log:m1", "meal_log:m1#dup2", "workout_log:1", "workout_log:1"}) {
		t.Fatalf("ledger reasons = %v, %v", reasons, err)
	}
	var sports int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM sport_types WHERE name = 'Parkour'`).Scan(&sports)
	if sports != 1 {
		t.Fatal("reference rows were not replaced by the source's")
	}
	// New rows after the import don't collide with imported ids.
	if _, err := owner.Exec(ctx, `INSERT INTO sport_types (name) VALUES ('Sequence check')`); err != nil {
		t.Fatalf("sequence not reset: %v", err)
	}

	// Ada signs in with her Supabase password; Bob (no password) can't until a reset.
	if _, err := svc.Login(ctx, "ADA@example.com", "Supabase-pw1", auth.Client{}); err != nil {
		t.Fatalf("imported login: %v", err)
	}
	if _, err := svc.Login(ctx, "bob@example.com", "anything1A", auth.Client{}); err == nil {
		t.Fatal("a password-less account signed in")
	}

	// A second import is refused: the target is no longer empty.
	if _, err := store.ImportSupabase(ctx, sourceURL, urls.Owner, false); err == nil {
		t.Fatal("imported twice")
	}
}
