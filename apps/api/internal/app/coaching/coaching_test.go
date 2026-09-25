package coaching

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
)

type fakeStore struct {
	role       string
	trainees   []TraineeRow
	joinStatus string
	failure    string
	savedCode  string
}

func (f *fakeStore) Role(context.Context, uuid.UUID) (string, error) { return f.role, nil }
func (f *fakeStore) Trainees(context.Context, uuid.UUID) ([]TraineeRow, error) {
	return f.trainees, nil
}
func (f *fakeStore) LoggedDates(context.Context, uuid.UUID, []uuid.UUID, string, string) (map[uuid.UUID][]string, error) {
	return map[uuid.UUID][]string{f.trainees[0].ID: {"2026-09-21"}}, nil
}
func (f *fakeStore) ScheduledDays(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID][]int, error) {
	return map[uuid.UUID][]int{f.trainees[0].ID: {1, 3}}, nil
}
func (f *fakeStore) ActivePlans(_ context.Context, _ uuid.UUID, ids []uuid.UUID) ([]ActivePlan, error) {
	created := time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC) // week 2 on Sep 24
	return []ActivePlan{{ID: uuid.Nil, UserID: ids[0], Kind: "hypertrophy", CreatedAt: created, WeeksTotal: 8}}, nil
}
func (f *fakeStore) PlanItems(_ context.Context, _ uuid.UUID, _ []uuid.UUID, weeks []int) ([]PlanWeekItem, error) {
	if len(weeks) != 1 || weeks[0] != 2 {
		return nil, errors.New("wrong week")
	}
	return []PlanWeekItem{
		{Week: 2, Item: scorecard.Item{ItemType: "strength", IsCompleted: true}},
		{Week: 2, Item: scorecard.Item{ItemType: "strength"}},
		{Week: 2, Item: scorecard.Item{ItemType: "meal_note"}},
		{Week: 1, Item: scorecard.Item{ItemType: "strength"}},
	}, nil
}
func (f *fakeStore) WeeklyXP(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]int64, error) {
	return map[uuid.UUID]int64{f.trainees[0].ID: 120}, nil
}
func (f *fakeStore) InviteCodes(context.Context, uuid.UUID) ([]InviteCode, error) {
	return []InviteCode{}, nil
}
func (f *fakeStore) SportExists(_ context.Context, id int64) (bool, error) { return id == 1, nil }
func (f *fakeStore) UpsertInviteCode(_ context.Context, _ uuid.UUID, _ int64, code string) error {
	f.savedCode = code
	return nil
}
func (f *fakeStore) JoinByCode(context.Context, uuid.UUID, string) (string, string, error) {
	return f.joinStatus, f.failure, nil
}
func (f *fakeStore) AssignSchedule(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return f.failure, nil
}

var today = func() time.Time { return time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC) }

func wantErr(t *testing.T, err error, kind apperr.Kind, message string) {
	t.Helper()
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Kind != kind || appErr.Message != message {
		t.Fatalf("err = %v, want %q", err, message)
	}
}

func TestHub(t *testing.T) {
	store := &fakeStore{role: "coach", trainees: []TraineeRow{{ID: uuid.New()}}}
	hub, err := NewService(store, today).Hub(context.Background(), uuid.New())
	if err != nil || hub.WeekStart != "2026-09-21" || len(hub.Trainees) != 1 {
		t.Fatalf("hub = %+v, %v", hub, err)
	}
	tr := hub.Trainees[0]
	if tr.WeeklyXP != 120 || tr.DoneCount != 1 || tr.ScheduledCount != 2 || tr.Week[2].State != "missed" {
		t.Errorf("trainee = %+v", tr)
	}
	if len(tr.Plans) != 1 || tr.Plans[0].AdherencePct != 50 {
		t.Errorf("plans = %+v", tr.Plans)
	}
	_, err = NewService(&fakeStore{role: "student"}, today).Hub(context.Background(), uuid.New())
	wantErr(t, err, apperr.Forbidden, "Only coaches can open the coaching hub.")
}

func TestInviteAndJoin(t *testing.T) {
	store := &fakeStore{role: "both", joinStatus: "reactivated"}
	svc := NewService(store, today)
	code, err := svc.GenerateInviteCode(context.Background(), uuid.New(), 1)
	if err != nil || code != store.savedCode || len(code) != len("COACH-1-XXXXXX") {
		t.Fatalf("code = %q, %v", code, err)
	}
	_, err = svc.GenerateInviteCode(context.Background(), uuid.New(), 9)
	wantErr(t, err, apperr.Invalid, "Invalid sport type.")
	joined, err := svc.Join(context.Background(), uuid.New(), "coach-1-abc")
	if err != nil || joined.Message != "Coach connection reactivated successfully." {
		t.Fatalf("join = %+v, %v", joined, err)
	}
	_, err = svc.Join(context.Background(), uuid.New(), "  ")
	wantErr(t, err, apperr.Invalid, "Please enter an invite code.")
	_, err = NewService(&fakeStore{role: "coach"}, today).Join(context.Background(), uuid.New(), "X")
	wantErr(t, err, apperr.Forbidden, "Your current role cannot add a coach.")
	_, err = NewService(&fakeStore{role: "student", failure: "Invalid invite code"}, today).Join(context.Background(), uuid.New(), "X")
	wantErr(t, err, apperr.Invalid, "Invalid invite code")
	_, err = NewService(&fakeStore{role: "student"}, today).AssignWeeklyPlan(context.Background(), uuid.New(), uuid.New())
	wantErr(t, err, apperr.Forbidden, "Your current role cannot assign plans to trainees.")
}
