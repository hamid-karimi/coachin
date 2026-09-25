package store_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// Row-level security is the safety net under the API's own checks (ADR-4).
// These tests connect as coachin_app, exactly like the running API.

func migratedDB(t *testing.T) dbURLs {
	t.Helper()
	urls := startPostgres(t)
	m, err := store.NewMigrator(context.Background(), urls.Owner, migrations(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = m.Close() }()
	if _, err := m.Up(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return urls
}

func TestEveryTableHasRowLevelSecurity(t *testing.T) {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, migratedDB(t).Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(ctx) }()

	rows, err := conn.Query(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'r'
		  AND c.relname <> 'goose_db_version' AND NOT c.relrowsecurity`)
	if err != nil {
		t.Fatal(err)
	}
	unprotected, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	if len(unprotected) > 0 {
		t.Fatalf("tables without row-level security: %v", unprotected)
	}
}

func TestUsersOnlySeeTheirOwnPrivateRows(t *testing.T) {
	urls := migratedDB(t)
	ownerURL, appURL := urls.Owner, urls.App
	ctx := context.Background()
	alice, bob := uuid.New(), uuid.New()

	// Arrange as the owner (bypasses RLS): two users, each with private rows.
	owner, err := pgx.Connect(ctx, ownerURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	for i, id := range []uuid.UUID{alice, bob} {
		email := []string{"alice@example.com", "bob@example.com"}[i]
		for _, stmt := range []string{
			"INSERT INTO users (id, email, password_hash) VALUES ($1, '" + email + "', 'x')",
			"INSERT INTO profiles (id) VALUES ($1)",
			"INSERT INTO body_measurements (user_id, weight_kg) VALUES ($1, 80)",
			"INSERT INTO supplements (user_id, name) VALUES ($1, 'Creatine')",
		} {
			if _, err := owner.Exec(ctx, stmt, id); err != nil {
				t.Fatalf("%s: %v", stmt, err)
			}
		}
	}

	pool, err := store.Open(ctx, appURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	count := func(tx pgx.Tx, query string, args ...any) int {
		t.Helper()
		var n int
		if err := tx.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return n
	}

	err = store.WithUser(ctx, pool, alice, func(tx pgx.Tx) error {
		for _, table := range []string{"body_measurements", "supplements"} {
			if n := count(tx, "SELECT count(*) FROM "+table+" WHERE user_id = $1", bob); n != 0 {
				t.Errorf("alice sees %d of bob's %s rows", n, table)
			}
			if n := count(tx, "SELECT count(*) FROM "+table); n != 1 {
				t.Errorf("alice sees %d %s rows, want her 1", n, table)
			}
		}
		if n := count(tx, "SELECT count(*) FROM users"); n != 1 {
			t.Errorf("alice sees %d accounts, want only her own", n)
		}
		// Password hashes are out of reach even for her own row.
		if _, err := tx.Exec(ctx, "SAVEPOINT hash_probe"); err != nil {
			return err
		}
		var hash string
		if err := tx.QueryRow(ctx, "SELECT password_hash FROM users").Scan(&hash); err == nil {
			t.Error("coachin_app can read password_hash")
		}
		if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT hash_probe"); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, "UPDATE profiles SET full_name = 'hacked' WHERE id = $1", bob)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 0 {
			t.Error("alice updated bob's profile")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	// Without a user context, policies fail closed.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	var n int
	if err := conn.QueryRow(ctx, "SELECT count(*) FROM supplements").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("no user context sees %d supplements, want 0", n)
	}
}

// Phase 5.2: a stranger sees only another user's public card; the coaching pair
// sees each other's profile; the card view is read-only; clubs are members-only.
func TestProfilePrivacy(t *testing.T) {
	urls := migratedDB(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	pool, err := store.Open(ctx, urls.App)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	ada, bob, coach := seedUser(t, owner, "ada@example.com"), seedUser(t, owner, "bob@example.com"), seedUser(t, owner, "coach@example.com")
	for _, stmt := range []string{
		`UPDATE profiles SET full_name = 'Bob', birth_date = '1990-01-01', weight_kg = 80 WHERE email = 'bob@example.com'`,
		`INSERT INTO coaching_relationships (coach_id, student_id, status) VALUES ('` + coach.String() + `', '` + bob.String() + `', 'active')`,
		`INSERT INTO clubs (name, owner_id, invite_code) VALUES ('Bob club', '` + bob.String() + `', 'CLUB-SECRET')`,
	} {
		if _, err := owner.Exec(ctx, stmt); err != nil {
			t.Fatalf("%s: %v", stmt, err)
		}
	}
	count := func(as uuid.UUID, sql string) int {
		t.Helper()
		var n int
		if err := store.WithUser(ctx, pool, as, func(tx pgx.Tx) error { return tx.QueryRow(ctx, sql, bob).Scan(&n) }); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
		return n
	}
	if n := count(ada, `SELECT count(*) FROM profiles WHERE id = $1`); n != 0 {
		t.Errorf("a stranger read the private profile row")
	}
	if n := count(ada, `SELECT count(*) FROM profile_cards WHERE id = $1 AND full_name = 'Bob'`); n != 1 {
		t.Errorf("a stranger can't read the public card")
	}
	if n := count(coach, `SELECT count(*) FROM profiles WHERE id = $1 AND weight_kg = 80`); n != 1 {
		t.Errorf("the coach can't read the trainee's profile")
	}
	if n := count(ada, `SELECT count(*) FROM clubs WHERE owner_id = $1`); n != 0 {
		t.Errorf("a non-member read the club and its invite code")
	}
	if n := count(bob, `SELECT count(*) FROM clubs WHERE owner_id = $1`); n != 1 {
		t.Errorf("the owner can't read their club")
	}
	if n := count(ada, `SELECT count(*) FROM public.get_weekly_leaderboard(ARRAY[$1::uuid], 1) lb WHERE to_jsonb(lb) ? 'email'`); n != 0 {
		t.Errorf("the weekly leaderboard still returns emails")
	}
	err = store.WithUser(ctx, pool, ada, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE profile_cards SET xp = 99999 WHERE id = $1`, ada)
		return err
	})
	if err == nil {
		t.Error("the card view accepted a write")
	}
}
