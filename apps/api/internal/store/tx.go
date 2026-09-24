package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WithUser runs fn in one transaction whose row-level-security context is
// userID: every policy calling app.current_user_id() sees this user. The
// setting is transaction-local, so a pooled connection never carries it into
// the next request. fn's error rolls the transaction back.
func WithUser(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, fn func(pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "SELECT set_config('app.user_id', $1, true)", userID.String()); err != nil {
			return fmt.Errorf("set user context: %w", err)
		}
		return fn(tx)
	})
}
