package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

var (
	_ training.SessionStore = (*TrainingStore)(nil)
	_ training.CheckinStore = (*TrainingStore)(nil)
)

// SessionItem loads the item if it belongs to one of the user's plans.
func (s *TrainingStore) SessionItem(ctx context.Context, userID, itemID uuid.UUID) (training.SessionItem, error) {
	var item training.SessionItem
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.GetSessionItem(ctx, queries.GetSessionItemParams{ID: itemID, UserID: userID})
		if errors.Is(err, pgx.ErrNoRows) {
			return training.ErrNotFound
		}
		if err != nil {
			return err
		}
		item = training.SessionItem{ItemType: row.ItemType, Title: row.Title, Details: row.Details}
		return nil
	})
	return item, err
}

// CreateSessionLog stores the log, marks the item done, and awards the +10 XP
// (session_log:<id>) in one transaction under the profile lock.
func (s *TrainingStore) CreateSessionLog(ctx context.Context, userID uuid.UUID, log training.NewSessionLog) (uuid.UUID, int, error) {
	var logID uuid.UUID
	rpe := pgtype.Int4{}
	if log.RPE != nil {
		rpe = pgtype.Int4{Int32: int32(*log.RPE), Valid: true}
	}
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		logID, err = q.InsertSessionLog(ctx, queries.InsertSessionLogParams{
			UserID: userID, PlanItemID: log.PlanItemID, Sport: log.Sport, Rpe: rpe, Actual: log.Actual, Note: log.Note,
		})
		if err != nil {
			return err
		}
		if err := q.MarkPlanItemCompleted(ctx, queries.MarkPlanItemCompletedParams{ID: log.PlanItemID, UserID: userID}); err != nil {
			return err
		}
		return addXP(ctx, q, userID, xp.SessionLogXP, "session_log:"+logID.String())
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return uuid.Nil, 0, training.ErrAlreadyLogged
	}
	if err != nil {
		return uuid.Nil, 0, err
	}
	return logID, xp.SessionLogXP, nil
}

// SaveFeedback stores the AI's comment on a session log.
func (s *TrainingStore) SaveFeedback(ctx context.Context, userID, logID uuid.UUID, feedback aigen.Feedback) error {
	raw, err := json.Marshal(feedback)
	if err != nil {
		return err
	}
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.SaveSessionFeedback(ctx, queries.SaveSessionFeedbackParams{Feedback: raw, ID: logID, UserID: userID})
	})
}

// ActivePlan loads one of the user's active plans.
func (s *TrainingStore) ActivePlan(ctx context.Context, userID, planID uuid.UUID) (training.CheckinPlan, error) {
	var plan training.CheckinPlan
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.GetActivePlan(ctx, queries.GetActivePlanParams{ID: planID, UserID: userID})
		if errors.Is(err, pgx.ErrNoRows) {
			return training.ErrNotFound
		}
		if err != nil {
			return err
		}
		plan = training.CheckinPlan{
			ID: row.ID, WeeksTotal: int(row.WeeksTotal), Summary: row.Summary, CreatedAt: row.CreatedAt, Intake: row.Intake,
		}
		return nil
	})
	return plan, err
}

// CheckinScorecard reads a plan week's recorded scorecard.
func (s *TrainingStore) CheckinScorecard(ctx context.Context, userID, planID uuid.UUID, week int) (json.RawMessage, bool, error) {
	var card []byte
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		card, err = q.GetCheckin(ctx, queries.GetCheckinParams{PlanID: planID, Week: int32(week), UserID: userID})
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	return card, err == nil, err
}

// WeekItems lists a plan's items in weeks from..to.
func (s *TrainingStore) WeekItems(ctx context.Context, userID, planID uuid.UUID, from, to int) ([]training.WeekItem, error) {
	var items []training.WeekItem
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		rows, err := q.ListPlanWeeksItems(ctx, queries.ListPlanWeeksItemsParams{
			PlanID: planID, UserID: userID, FromWeek: int32(from), ToWeek: int32(to),
		})
		if err != nil {
			return err
		}
		items = make([]training.WeekItem, len(rows))
		for i, r := range rows {
			items[i] = training.WeekItem{
				ID: r.ID, Week: int(r.Week), DayOfWeek: int(r.DayOfWeek), ItemType: r.ItemType,
				Title: r.Title, Details: r.Details, IsCompleted: r.IsCompleted,
			}
		}
		return nil
	})
	return items, err
}

// SessionLogs loads the user's logs of these plan items.
func (s *TrainingStore) SessionLogs(ctx context.Context, userID uuid.UUID, itemIDs []uuid.UUID) ([]training.LoggedSession, error) {
	var logs []training.LoggedSession
	if len(itemIDs) == 0 {
		return logs, nil
	}
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		rows, err := q.ListSessionLogs(ctx, queries.ListSessionLogsParams{UserID: userID, ItemIds: itemIDs})
		if err != nil {
			return err
		}
		logs = make([]training.LoggedSession, len(rows))
		for i, r := range rows {
			log := scorecard.SessionLog{Note: r.Note}
			_ = json.Unmarshal(r.Actual, &log.Actual)
			_ = json.Unmarshal(r.AiFeedback, &log.AIFeedback)
			logs[i] = training.LoggedSession{PlanItemID: r.PlanItemID, Log: log}
		}
		return nil
	})
	return logs, err
}

// ApplyWeekAdjustment records the check-in, rewrites only the target week, and
// pays +20 XP once per reviewed week (weekly_checkin:<plan>:<week>) — one
// transaction under the profile lock.
func (s *TrainingStore) ApplyWeekAdjustment(ctx context.Context, userID uuid.UUID, adj training.WeekAdjustment) (int, error) {
	card, err := json.Marshal(adj.Scorecard)
	if err != nil {
		return 0, err
	}
	var awarded int
	err = s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		weeks, err := q.ActivePlanLength(ctx, queries.ActivePlanLengthParams{ID: adj.PlanID, UserID: userID})
		if errors.Is(err, pgx.ErrNoRows) {
			return training.ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("load plan: %w", err)
		}
		if adj.CheckinWeek < 1 || adj.CheckinWeek > int(weeks) || adj.TargetWeek < 1 || adj.TargetWeek > int(weeks) {
			return fmt.Errorf("check-in weeks %d → %d outside a %d-week plan", adj.CheckinWeek, adj.TargetWeek, weeks)
		}
		if err := q.InsertWeeklyCheckin(ctx, queries.InsertWeeklyCheckinParams{
			PlanID: adj.PlanID, Week: int32(adj.CheckinWeek), Scorecard: card, Decision: string(adj.Decision), Summary: adj.Summary, // #nosec G115 -- ≤ 24 weeks
		}); err != nil {
			return err
		}
		if err := replaceWeek(ctx, q, adj.PlanID, adj.TargetWeek, adj.Items); err != nil {
			return err
		}
		reason := "weekly_checkin:" + adj.PlanID.String() + ":" + strconv.Itoa(adj.CheckinWeek)
		paid, err := q.LedgerHasReason(ctx, queries.LedgerHasReasonParams{UserID: &userID, Reason: reason})
		if err != nil || paid {
			return err
		}
		awarded = xp.WeeklyCheckinXP
		return addXP(ctx, q, userID, awarded, reason)
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return 0, training.ErrAlreadyCheckedIn
	}
	return awarded, err
}

// replaceWeek swaps one week's items for items (their own week values are
// ignored: the target week is forced).
func replaceWeek(ctx context.Context, q *queries.Queries, planID uuid.UUID, week int, items []aigen.PlanItemInput) error {
	if err := q.DeleteWeekItems(ctx, queries.DeleteWeekItemsParams{PlanID: planID, Week: int32(week)}); err != nil { // #nosec G115 -- ≤ 24 weeks
		return fmt.Errorf("clear week: %w", err)
	}
	for _, item := range items {
		details, err := json.Marshal(item.Details)
		if err != nil {
			return err
		}
		if err := q.InsertWeekItem(ctx, queries.InsertWeekItemParams{
			PlanID: planID, Week: int32(week), DayOfWeek: int16(item.DayOfWeek), ItemType: item.ItemType, // #nosec G115 -- validated 0–6
			Title: item.Title, Details: details, Description: item.Description,
		}); err != nil {
			return fmt.Errorf("insert item: %w", err)
		}
	}
	return nil
}
