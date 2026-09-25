package activities

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

// ErrNoRunningSport is returned by the store when no sport named like "run" exists.
var ErrNoRunningSport = errors.New("no running sport type")

// ErrAlreadyAwarded means a date's run XP is already in the ledger, though its
// log is gone (the ledger's once-only index caught it).
var ErrAlreadyAwarded = errors.New("run already awarded")

// RunningSport is the sport imported runs are logged under.
type RunningSport struct {
	ID         int64
	Multiplier *float64
}

// NewRun is one completed log to insert, with its XP.
type NewRun struct {
	Date   string
	Notes  string
	XP     int64
	Reason string
}

// Plan picks the runs to insert, given the running sport and the dates that
// already have a completed log of it.
type Plan func(sport RunningSport, existingDates []string) ([]NewRun, error)

// ImportStore writes imported runs.
type ImportStore interface {
	// ImportRuns runs plan and inserts its runs, their ledger rows, and the
	// XP in one transaction under the profile lock.
	ImportRuns(ctx context.Context, userID uuid.UUID, dates []string, plan Plan) error
}

// Importer logs parsed watch-file runs (FORMULAS §14). now is injectable for tests.
type Importer struct {
	store ImportStore
	now   func() time.Time
}

// NewImporter builds the importer; now defaults to time.Now.
func NewImporter(store ImportStore, now func() time.Time) *Importer {
	if now == nil {
		now = time.Now
	}
	return &Importer{store: store, now: now}
}

// ImportNote is the log's note (legacy copy).
func ImportNote(a activity.Summary) string {
	return fmt.Sprintf("Imported from watch file — %s km in %s min", jsnum.FormatNumber(a.DistanceKm), jsnum.FormatNumber(a.DurationMin))
}

// skippedMessage says why nothing imported.
func skippedMessage(split activity.Split) string {
	if len(split.Duplicates) > 0 {
		return "Those days already have a logged run"
	}
	return "Only runs from the last 14 days can be imported"
}

// Import sanitizes client-sent summaries (as returned by Parse), keeps the
// last 14 days' runs without a log that date, and logs each as a completed run
// worth 60 × the running multiplier.
func (s *Importer) Import(ctx context.Context, userID uuid.UUID, raw []any) (string, error) {
	acts := activity.Sanitize(raw)
	if len(acts) == 0 {
		return "", apperr.New(apperr.Invalid, "No importable runs in those files")
	}
	onDates := make([]string, len(acts))
	for i, a := range acts {
		onDates[i] = a.Date
	}
	today := dates.ToYMD(s.now())
	var (
		split  activity.Split
		earned int64
	)
	err := s.store.ImportRuns(ctx, userID, onDates, func(sport RunningSport, existing []string) ([]NewRun, error) {
		var err error
		if split, err = activity.SplitImportable(acts, existing, today); err != nil {
			return nil, err
		}
		if len(split.Importable) == 0 {
			return nil, apperr.New(apperr.Invalid, skippedMessage(split))
		}
		perRun := int64(jsnum.Round(xp.BaseWorkoutXP * xp.Multiplier(sport.Multiplier)))
		runs := make([]NewRun, len(split.Importable))
		for i, a := range split.Importable {
			runs[i] = NewRun{
				Date: a.Date, Notes: ImportNote(a), XP: perRun,
				Reason: "workout_log:" + strconv.FormatInt(sport.ID, 10) + ":" + a.Date,
			}
		}
		earned = perRun * int64(len(runs))
		return runs, nil
	})
	if errors.Is(err, ErrNoRunningSport) {
		return "", apperr.New(apperr.Unavailable, "No running sport type is configured")
	}
	if errors.Is(err, ErrAlreadyAwarded) {
		return "", apperr.New(apperr.Conflict, "Those days already have a logged run")
	}
	if err != nil {
		return "", err
	}
	return importedMessage(len(split.Importable), earned, len(split.Duplicates)+len(split.OutOfWindow)), nil
}

// importedMessage is "Imported 2 runs · +120 XP · 1 skipped (…)".
func importedMessage(imported int, earned int64, skipped int) string {
	noun := map[bool]string{true: "run", false: "runs"}[imported == 1]
	msg := fmt.Sprintf("Imported %d %s · +%d XP", imported, noun, earned)
	if skipped > 0 {
		msg += fmt.Sprintf(" · %d skipped (already logged or older than 14 days)", skipped)
	}
	return msg
}
