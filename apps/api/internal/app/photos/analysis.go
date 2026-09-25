package photos

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// maxStoredBytes bounds reading a stored photo back (they are ≤1600 px JPEGs).
const maxStoredBytes = 10 << 20

// Library is the list view: images by kind plus the latest body analysis.
type Library struct {
	Photos    []Photo
	Analysis  *aigen.BodyAnalysis
	Consented bool
}

// Library reads the user's images, the newest body photo's analysis, and
// whether they consented to AI analysis.
func (s *Service) Library(ctx context.Context, userID uuid.UUID) (Library, error) {
	list, err := s.store.Photos(ctx, userID)
	if err != nil {
		return Library{}, fmt.Errorf("list photos: %w", err)
	}
	consented, err := s.store.Consented(ctx, userID)
	if err != nil {
		return Library{}, fmt.Errorf("read consent: %w", err)
	}
	lib := Library{Photos: list, Consented: consented}
	for _, p := range list {
		if p.Kind != BodyPhoto || p.Analysis == nil {
			continue
		}
		var a aigen.BodyAnalysis
		if json.Unmarshal(p.Analysis, &a) == nil && (a.BuildNotes != "" || a.PostureNotes != "") {
			lib.Analysis = &a
		}
		break
	}
	return lib, nil
}

// read loads a stored image.
func (s *Service) read(ctx context.Context, path string) ([]byte, error) {
	body, _, err := s.objects.Get(ctx, path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = body.Close() }()
	return io.ReadAll(io.LimitReader(body, maxStoredBytes))
}

// Analyze records consent (first time), reads the newest 5 body photos in one
// AI call, and stores the result on the newest one — where the training and
// meal-plan prompts pick it up.
func (s *Service) Analyze(ctx context.Context, userID uuid.UUID, consent bool) (string, error) {
	if !consent {
		return "", apperr.New(apperr.Invalid, "Tick the consent box to run AI analysis")
	}
	if err := s.store.RecordConsent(ctx, userID); err != nil {
		return "", fmt.Errorf("record consent: %w", err)
	}
	photos, err := s.store.PathsOfKind(ctx, userID, BodyPhoto, caps[BodyPhoto])
	if err != nil {
		return "", fmt.Errorf("list body photos: %w", err)
	}
	if len(photos) == 0 {
		return "", apperr.New(apperr.Invalid, "Upload at least one body photo first")
	}
	var images [][]byte
	for _, p := range photos {
		if data, err := s.read(ctx, p.Path); err == nil {
			images = append(images, data)
		}
	}
	if len(images) == 0 {
		return "", apperr.New(apperr.Unavailable, "Could not read your photos — try again")
	}
	analysis, err := aigen.ParseBodyAnalysis(s.ai.GenerateJSON(ctx, aigen.BodyAnalysisRequest(images)))
	if err != nil {
		return "", apperr.New(apperr.Unavailable, err.Error())
	}
	raw, err := json.Marshal(analysis)
	if err != nil {
		return "", err
	}
	if err := s.store.SaveAnalysis(ctx, userID, photos[0].ID, raw); err != nil {
		return "", fmt.Errorf("save analysis: %w", err)
	}
	return "Body analysis ready.", nil
}

// noMetrics is a readable report without weight or body fat.
const noMetrics = "Couldn't read weight or body fat from this report — try a clearer photo"

// Extract reads weight / body fat / muscle mass from a report photo. Nothing
// becomes a measurement until the user confirms it.
func (s *Service) Extract(ctx context.Context, userID, id uuid.UUID) (aigen.ReportMetrics, error) {
	path, ok, err := s.store.PhotoPathOfKind(ctx, userID, id, Report)
	if err != nil {
		return aigen.ReportMetrics{}, fmt.Errorf("find report: %w", err)
	}
	if !ok {
		return aigen.ReportMetrics{}, apperr.New(apperr.NotFound, "Report not found")
	}
	data, err := s.read(ctx, path)
	if err != nil {
		return aigen.ReportMetrics{}, apperr.New(apperr.Unavailable, "Could not read the report image")
	}
	metrics, err := aigen.ParseReportMetrics(s.ai.GenerateJSON(ctx, aigen.ReportRequest(data)))
	if err != nil {
		return aigen.ReportMetrics{}, apperr.New(apperr.Unavailable, err.Error())
	}
	if metrics.WeightKg == nil && metrics.BodyFatPct == nil {
		return aigen.ReportMetrics{}, apperr.New(apperr.Invalid, noMetrics)
	}
	raw, err := json.Marshal(metrics)
	if err != nil {
		return aigen.ReportMetrics{}, err
	}
	if err := s.store.SaveAnalysis(ctx, userID, id, raw); err != nil {
		return aigen.ReportMetrics{}, fmt.Errorf("save metrics: %w", err)
	}
	return metrics, nil
}
