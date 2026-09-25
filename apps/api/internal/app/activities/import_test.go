package activities

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
)

type fakeImportStore struct {
	sport    *RunningSport
	existing []string
	dates    []string
	runs     []NewRun
}

func (f *fakeImportStore) ImportRuns(_ context.Context, _ uuid.UUID, dates []string, plan Plan) error {
	f.dates = dates
	if f.sport == nil {
		return ErrNoRunningSport
	}
	runs, err := plan(*f.sport, f.existing)
	f.runs = runs
	return err
}

func run(date string, km float64) map[string]any {
	return map[string]any{"date": date, "distance_km": km, "duration_min": 30.04, "source": "fit"}
}

func TestImport(t *testing.T) {
	now := func() time.Time { return time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC) }
	multiplier := 1.5
	store := &fakeImportStore{sport: &RunningSport{ID: 3, Multiplier: &multiplier}, existing: []string{"2026-09-23"}}
	imp := NewImporter(store, now)

	msg, err := imp.Import(context.Background(), uuid.New(), []any{
		run("2026-09-24", 5.021), run("2026-09-24", 6), // same date twice: first wins
		run("2026-09-23", 4),  // already logged
		run("2026-09-01", 10), // out of window
		run("2026-09-25", 3.5),
	})
	if err != nil || msg != "Imported 2 runs · +180 XP · 3 skipped (already logged or older than 14 days)" {
		t.Fatalf("Import = %q, %v", msg, err)
	}
	if len(store.dates) != 5 || store.runs[0].Notes != "Imported from watch file — 5.02 km in 30 min" ||
		store.runs[0].Reason != "workout_log:3:2026-09-24" || store.runs[1].XP != 90 {
		t.Fatalf("runs = %+v", store.runs)
	}

	cases := []struct {
		store *fakeImportStore
		raw   []any
		want  string
	}{
		{&fakeImportStore{}, []any{map[string]any{"date": "bad"}}, "No importable runs in those files"},
		{&fakeImportStore{sport: &RunningSport{ID: 3}, existing: []string{"2026-09-24"}}, []any{run("2026-09-24", 5)}, "Those days already have a logged run"},
		{&fakeImportStore{sport: &RunningSport{ID: 3}}, []any{run("2026-08-01", 5)}, "Only runs from the last 14 days can be imported"},
		{&fakeImportStore{}, []any{run("2026-09-24", 5)}, "No running sport type is configured"},
	}
	for _, c := range cases {
		_, err := NewImporter(c.store, now).Import(context.Background(), uuid.New(), c.raw)
		var appErr *apperr.Error
		if !errors.As(err, &appErr) || appErr.Message != c.want {
			t.Errorf("err = %v, want %q", err, c.want)
		}
	}
	msg, _ = NewImporter(&fakeImportStore{sport: &RunningSport{ID: 1}}, now).Import(context.Background(), uuid.New(), []any{run("2026-09-25", 5)})
	if msg != "Imported 1 run · +60 XP" {
		t.Errorf("single = %q", msg)
	}
}
