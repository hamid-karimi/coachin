package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/password"
	"github.com/hamid-karimi/coachin/apps/api/internal/config"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// demoPassword satisfies the sign-up rules; local development only.
const demoPassword = "Coachin-demo1"

type demoAccount struct {
	email, name, role string
}

var demoAccounts = []demoAccount{
	{"trainee@coachin.local", "Tara Trainee", "student"},
	{"coach@coachin.local", "Cody Coach", "coach"},
}

// seed loads local demo data: a trainee with a weekly routine, and a coach
// connected to them. Idempotent — existing accounts are left alone.
func seed(ctx context.Context, _ []string, logger *slog.Logger) error {
	url, err := config.LoadMigrate(os.Getenv)
	if err != nil {
		return err
	}
	pool, err := store.Open(ctx, url)
	if err != nil {
		return err
	}
	defer pool.Close()

	hash, err := password.New(password.DefaultParams).Hash(demoPassword)
	if err != nil {
		return err
	}

	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		ids := map[string]string{}
		for _, a := range demoAccounts {
			var id string
			err := tx.QueryRow(ctx, `
				WITH created AS (
					INSERT INTO users (email, password_hash, email_verified_at)
					VALUES ($1, $2, now())
					ON CONFLICT (email) DO NOTHING
					RETURNING id
				)
				SELECT id::text FROM created
				UNION ALL SELECT id::text FROM users WHERE email = $1
				LIMIT 1`, a.email, hash).Scan(&id)
			if err != nil {
				return fmt.Errorf("seed %s: %w", a.email, err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO profiles (id, email, full_name, role) VALUES ($1, $2, $3, $4)
				ON CONFLICT (id) DO NOTHING`, id, a.email, a.name, a.role); err != nil {
				return err
			}
			ids[a.role] = id
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO coaching_relationships (coach_id, student_id, status)
			SELECT $1, $2, 'active'
			WHERE NOT EXISTS (SELECT 1 FROM coaching_relationships WHERE coach_id = $1 AND student_id = $2)`,
			ids["coach"], ids["student"]); err != nil {
			return err
		}

		// Trainee routine: runs on Mon/Wed mornings, strength on Friday.
		if _, err := tx.Exec(ctx, `
			INSERT INTO schedules (user_id, day_of_week, sport_type_id, time)
			SELECT $1, routine.day, st.id, routine.at::time
			FROM (VALUES (1, 'Running', '07:00'), (3, 'Running', '07:00'), (5, 'Strength training', '18:30'))
				AS routine(day, sport, at)
			JOIN sport_types st ON st.name = routine.sport
			WHERE NOT EXISTS (SELECT 1 FROM schedules WHERE user_id = $1)`, ids["student"]); err != nil {
			return err
		}

		for _, a := range demoAccounts {
			logger.Info("demo account", "email", a.email, "role", a.role, "password", demoPassword)
		}
		return nil
	})
}
