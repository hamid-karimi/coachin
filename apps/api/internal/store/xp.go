package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
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
