package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// xpOnceIndex makes every ledger reason but the plan-item toggle pair once-only
// (migration 00009).
const xpOnceIndex = "xp_transactions_once_idx"

// awardedTwice reports whether err is a ledger insert that repeated a once-only
// reason — a race past a use case's own check, or a check that drifted.
func awardedTwice(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == uniqueViolation && pgErr.ConstraintName == xpOnceIndex
}

// addXP writes one ledger row and moves the balance by amount (0 writes nothing).
func addXP(ctx context.Context, q *queries.Queries, userID uuid.UUID, amount int, reason string) error {
	if amount == 0 {
		return nil
	}
	if err := q.InsertXPTransaction(ctx, queries.InsertXPTransactionParams{UserID: userID, Amount: int32(amount), Reason: reason}); err != nil { // #nosec G115 -- small award
		return fmt.Errorf("insert xp transaction: %w", err)
	}
	if _, err := q.AddProfileXP(ctx, queries.AddProfileXPParams{UserID: userID, Amount: int32(amount)}); err != nil { // #nosec G115 -- small award
		return fmt.Errorf("add profile xp: %w", err)
	}
	return nil
}
