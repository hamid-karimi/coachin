package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// TodayStore implements today.Store on the coachin_app pool. Quotas and
// week logs come from the embedded RoutineStore.
type TodayStore struct {
	*RoutineStore
}

var _ today.Store = (*TodayStore)(nil)

// NewTodayStore wraps a pool connected as coachin_app.
func NewTodayStore(pool *pgxpool.Pool) *TodayStore {
	return &TodayStore{RoutineStore: NewRoutineStore(pool)}
}

// SettleStreak runs evaluate_user_streak. The function reports its own
// failures in its result and never blocks the page, as in the legacy app.
func (s *TodayStore) SettleStreak(ctx context.Context, userID uuid.UUID) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		_, err := q.SettleStreak(ctx)
		return err
	})
}

// Stats reads the profile's counters.
func (s *TodayStore) Stats(ctx context.Context, userID uuid.UUID) (today.ProfileStats, error) {
	var stats today.ProfileStats
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.TodayProfile(ctx, userID)
		if err != nil {
			return err
		}
		stats = today.ProfileStats{
			XP: row.Xp, CurrentStreak: int(row.CurrentStreak), BestStreak: int(row.BestStreak),
			Hearts: int(row.Hearts), LeagueTier: row.LeagueTier,
		}
		return nil
	})
	return stats, err
}

// SessionsOn lists the weekday's fixed sessions active on date.
func (s *TodayStore) SessionsOn(ctx context.Context, userID uuid.UUID, weekday int, date string) ([]today.SessionRow, error) {
	var rows []queries.ListSessionsOnRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListSessionsOn(ctx, queries.ListSessionsOnParams{
			UserID: userID, DayOfWeek: int16(weekday), OnDate: date, // #nosec G115 -- 0..6
		})
		return err
	})
	sessions := make([]today.SessionRow, len(rows))
	for i, r := range rows {
		sessions[i] = today.SessionRow{
			ScheduleID: r.ID, SportTypeID: r.SportTypeID, SportName: r.SportName,
			Time: clock(r.Time), XPMultiplier: float4(r.XpMultiplier),
		}
	}
	return sessions, err
}

// LoggedSportsOn lists the sports with a log on date.
func (s *TodayStore) LoggedSportsOn(ctx context.Context, userID uuid.UUID, date string) ([]int64, error) {
	var ids []*int64
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		ids, err = q.ListLoggedSportsOn(ctx, queries.ListLoggedSportsOnParams{UserID: userID, OnDate: date})
		return err
	})
	sports := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id != nil {
			sports = append(sports, *id)
		}
	}
	return sports, err
}

// ActivePlans lists the user's active plans, running before hypertrophy.
func (s *TodayStore) ActivePlans(ctx context.Context, userID uuid.UUID) ([]routine.Plan, error) {
	var rows []queries.ListActivePlansRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListActivePlans(ctx, userID)
		return err
	})
	plans := make([]routine.Plan, len(rows))
	for i, r := range rows {
		plans[i] = routine.Plan{ID: r.ID, CreatedAt: r.CreatedAt, WeeksTotal: int(r.WeeksTotal)}
	}
	return plans, err
}

// PlanItemsOn lists the weekday's items of each plan's week.
func (s *TodayStore) PlanItemsOn(ctx context.Context, userID uuid.UUID, weekday int, weekByPlan map[uuid.UUID]int) ([]today.PlanItemRow, error) {
	params := queries.ListPlanItemsForWeeksParams{UserID: userID, DayOfWeek: int16(weekday)} // #nosec G115 -- 0..6
	for id, week := range weekByPlan {
		params.PlanIds = append(params.PlanIds, id)
		params.Weeks = append(params.Weeks, int32(week)) // #nosec G115 -- plan weeks ≤ 24
	}
	var rows []queries.ListPlanItemsForWeeksRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListPlanItemsForWeeks(ctx, params)
		return err
	})
	items := make([]today.PlanItemRow, len(rows))
	for i, r := range rows {
		items[i] = today.PlanItemRow{
			PlanItem: routine.PlanItem{
				ID: r.ID, DayOfWeek: int(r.DayOfWeek), ItemType: r.ItemType, Title: r.Title,
				Description: r.Description, IsCompleted: r.IsCompleted, Details: planitem.ParseDetails(r.Details),
			},
			PlanID: r.PlanID, Week: int(r.Week),
		}
	}
	return items, err
}

// LastProgressPhotoAt is the newest progress photo's time, or nil.
func (s *TodayStore) LastProgressPhotoAt(ctx context.Context, userID uuid.UUID) (*time.Time, error) {
	var last *time.Time
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		at, err := q.LastProgressPhotoAt(ctx, userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		last = &at
		return nil
	})
	return last, err
}

// SportMultiplier reads a sport's stored multiplier.
func (s *TodayStore) SportMultiplier(ctx context.Context, sportTypeID int64) (*float64, bool, error) {
	raw, err := queries.New(s.pool).SportMultiplier(ctx, sportTypeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return float4(raw), true, nil
}

// LogWorkout writes the log, the ledger row, and the balance together. The
// profile row lock serializes a user's concurrent logs, so a double tap
// cannot slip past the once-a-day check.
func (s *TodayStore) LogWorkout(ctx context.Context, userID uuid.UUID, log today.NewWorkoutLog) (int64, error) {
	var total int64
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		logged, err := q.HasLoggedSportOn(ctx, queries.HasLoggedSportOnParams{UserID: userID, SportTypeID: log.SportTypeID, OnDate: log.Date})
		if err != nil {
			return err
		}
		if logged {
			return today.ErrAlreadyLogged
		}
		if err := q.InsertWorkoutLog(ctx, queries.InsertWorkoutLogParams{UserID: userID, SportTypeID: log.SportTypeID, OnDate: log.Date}); err != nil {
			return fmt.Errorf("insert log: %w", err)
		}
		if err := q.InsertXPTransaction(ctx, queries.InsertXPTransactionParams{UserID: userID, Amount: int32(log.XP), Reason: log.Reason}); err != nil { // #nosec G115 -- small award
			return fmt.Errorf("insert xp transaction: %w", err)
		}
		total, err = q.AddProfileXP(ctx, queries.AddProfileXPParams{UserID: userID, Amount: int32(log.XP)}) // #nosec G115 -- small award
		return err
	})
	return total, err
}
