package httpapi

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/activities"
)

// ActivityService parses watch files.
type ActivityService interface {
	Parse(uploads []activities.Upload) (activities.Parsed, error)
}

// ActivityImporter logs parsed runs.
type ActivityImporter interface {
	Import(ctx context.Context, userID uuid.UUID, raw []any) (string, error)
}

// ActivitySummaryBody is one run read from a watch file.
type ActivitySummaryBody struct {
	Date         string   `json:"date" format:"date" doc:"UTC date of the start"`
	DistanceKm   float64  `json:"distanceKm"`
	DurationMin  float64  `json:"durationMin"`
	AvgPaceMinKm *float64 `json:"avgPaceMinKm"`
	AvgHR        *float64 `json:"avgHr"`
	Source       string   `json:"source" enum:"fit,gpx"`
}

// ActivitiesParsedBody is the parse outcome; nothing is stored.
type ActivitiesParsedBody struct {
	ResultBody
	Activities []ActivitySummaryBody `json:"activities"`
}

type activitiesParsedOutput struct {
	Body ActivitiesParsedBody
}

type watchFiles struct {
	Activities []huma.FormFile `form:"activities" doc:".fit or .gpx exports, up to 3 files of 4 MB"`
}

type parseActivitiesInput struct {
	RawBody huma.MultipartFormFiles[watchFiles]
}

// maxUploadBytes caps the whole multipart body (huma leaves it unbounded):
// three 4 MB files plus room for oversized ones to be reported, not cut off.
const maxUploadBytes = 20 << 20

// limitBody bounds the request body before the multipart form is parsed.
func limitBody(n int64) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		r, w := humachi.Unwrap(ctx)
		r.Body = http.MaxBytesReader(w, r.Body, n)
		next(ctx)
	}
}

type importActivitiesInput struct {
	Body struct {
		Activities []ActivitySummaryBody `json:"activities" maxItems:"20" doc:"Runs as returned by POST /activities/parse"`
	}
}

// legacySummary is the snake_case shape activity.Sanitize validates.
func legacySummary(a ActivitySummaryBody) map[string]any {
	return map[string]any{
		"date": a.Date, "distance_km": a.DistanceKm, "duration_min": a.DurationMin, "avg_hr": derefOr(a.AvgHR), "source": a.Source,
	}
}

func derefOr(v *float64) any {
	if v == nil {
		return nil
	}
	return *v
}

func registerActivities(api huma.API, deps Deps) {
	svc, importer, logger := deps.Activities, deps.ActivityImport, deps.logger()

	huma.Register(api, huma.Operation{
		OperationID: "parseActivities", Method: http.MethodPost, Path: "/activities/parse",
		Summary:     "Read run summaries from watch files (.fit / .gpx)",
		Description: "Nothing is stored. Files that can't be read are reported in the message; 400 when none can.",
		Tags:        []string{"activities"},
		Middlewares: huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 10)), limitBody(maxUploadBytes)},
		Errors:      []int{400, 401, 422, 429},
	}, func(ctx context.Context, in *parseActivitiesInput) (*activitiesParsedOutput, error) {
		files := in.RawBody.Data().Activities
		uploads := make([]activities.Upload, len(files))
		for i, f := range files {
			uploads[i] = activities.Upload{Name: f.Filename, Size: f.Size}
			if f.Size <= activities.MaxFileBytes && len(files) <= activities.MaxFiles {
				data, err := io.ReadAll(io.LimitReader(f, activities.MaxFileBytes+1))
				if err != nil {
					return nil, toProblem(ctx, logger, err)
				}
				uploads[i].Data = data
			}
		}
		parsed, err := svc.Parse(uploads)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := ActivitiesParsedBody{
			ResultBody: ResultBody{Status: parsed.Status, Message: parsed.Message},
			Activities: make([]ActivitySummaryBody, len(parsed.Activities)),
		}
		for i, a := range parsed.Activities {
			body.Activities[i] = ActivitySummaryBody{
				Date: a.Date, DistanceKm: a.DistanceKm, DurationMin: a.DurationMin,
				AvgPaceMinKm: a.AvgPaceMinKm, AvgHR: a.AvgHR, Source: a.Source,
			}
		}
		return &activitiesParsedOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "importActivities", Method: http.MethodPost, Path: "/activities/import",
		Summary:     "Log parsed runs as completed workouts (+60 × running multiplier each)",
		Description: "Only the last 14 days; a date that already has a logged run is skipped (FORMULAS §14).",
		Tags:        []string{"activities"}, DefaultStatus: http.StatusCreated,
		Middlewares: huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 10))},
		Errors:      []int{400, 401, 429, 502},
	}, func(ctx context.Context, in *importActivitiesInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		raw := make([]any, len(in.Body.Activities))
		for i, a := range in.Body.Activities {
			raw[i] = legacySummary(a)
		}
		msg, err := importer.Import(ctx, userID, raw)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}, nil
	})
}
