// Package photos is the body / progress photo use cases: upload (normalize →
// AI moderation → object storage + row), list, read back, delete. Storage is
// private; every read goes through the API's ownership check.
package photos

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// Kind is what a stored image is.
type Kind string

// Kinds (body_photos.kind).
const (
	BodyPhoto Kind = "body_photo"
	Report    Kind = "analysis_report"
	Progress  Kind = "progress"
)

// Limits (legacy).
const (
	MaxBatch       = 5
	MaxUploadBytes = 5 << 20
	MaxProgress    = 24
)

// caps is how many of each kind a user may keep.
var caps = map[Kind]int{BodyPhoto: 5, Report: 3, Progress: MaxProgress}

// capMessages are the per-kind "full" rejections in a batch.
var capMessages = map[Kind]string{BodyPhoto: "you already have 5 photos", Report: "you already have 3 reports"}

// Upload is one submitted file; Data is nil when it is over MaxUploadBytes.
type Upload struct {
	Name string
	Size int64
	Data []byte
}

// Photo is one stored image's metadata.
type Photo struct {
	ID         uuid.UUID
	Kind       Kind
	CreatedAt  time.Time
	Analysis   []byte // JSON, nil until analyzed
	AnalyzedAt *time.Time
}

// Store persists photo rows; every call is scoped to the user.
type Store interface {
	CountPhotos(ctx context.Context, userID uuid.UUID) (map[Kind]int, error)
	// InsertPhoto adds a row unless the user already has limit of that kind
	// (checked under the profile lock); false when full.
	InsertPhoto(ctx context.Context, userID uuid.UUID, path string, kind Kind, limit int) (bool, error)
	Photos(ctx context.Context, userID uuid.UUID) ([]Photo, error)
	PhotoPath(ctx context.Context, userID, id uuid.UUID) (string, bool, error)
	// DeletePhoto removes the row and returns its storage path.
	DeletePhoto(ctx context.Context, userID, id uuid.UUID) (string, bool, error)
	RecordConsent(ctx context.Context, userID uuid.UUID) error
	Consented(ctx context.Context, userID uuid.UUID) (bool, error)
	// PathsOfKind lists the newest limit images of a kind (id, storage path).
	PathsOfKind(ctx context.Context, userID uuid.UUID, kind Kind, limit int) ([]StoredPhoto, error)
	PhotoPathOfKind(ctx context.Context, userID, id uuid.UUID, kind Kind) (string, bool, error)
	SaveAnalysis(ctx context.Context, userID, id uuid.UUID, analysis []byte) error
}

// StoredPhoto is a row's id and object key.
type StoredPhoto struct {
	ID   uuid.UUID
	Path string
}

// Objects is the private bucket.
type Objects interface {
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Get(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
}

// Normalizer re-encodes an upload as an upright, metadata-free JPEG.
type Normalizer interface {
	Normalize(data []byte) ([]byte, error)
}

// AI generates structured JSON (the moderation gate).
type AI interface {
	GenerateJSON(ctx context.Context, req aigen.Request) (aigen.Result, bool)
}

// Service runs the use cases.
type Service struct {
	store      Store
	objects    Objects
	normalizer Normalizer
	ai         AI
}

// NewService builds the service.
func NewService(store Store, objects Objects, normalizer Normalizer, ai AI) *Service {
	return &Service{store: store, objects: objects, normalizer: normalizer, ai: ai}
}

// Uploaded is a batch outcome: "success", or "info" when some files were rejected.
type Uploaded struct {
	Status  string
	Message string
}

// prepared is a normalized, moderated image ready to store.
type prepared struct {
	jpeg []byte
	kind Kind
}

// errModerationDown stops a batch: every later file would fail the same way.
var errModerationDown = errors.New(aigen.ModerationUnavailable)

// prepare validates, normalizes, and moderates one file; the error text is
// the user-facing reason.
func (s *Service) prepare(ctx context.Context, u Upload) (prepared, error) {
	if u.Size > MaxUploadBytes || u.Data == nil {
		return prepared{}, errors.New("must be 5MB or smaller")
	}
	jpeg, err := s.normalizer.Normalize(u.Data)
	if err != nil {
		return prepared{}, errors.New("use a JPEG, PNG, or WebP image")
	}
	verdict := aigen.ParseModeration(s.ai.GenerateJSON(ctx, aigen.ModerationRequest(jpeg)))
	if verdict.Unavailable {
		return prepared{}, errModerationDown
	}
	if !verdict.OK {
		return prepared{}, errors.New(verdict.Reason)
	}
	return prepared{jpeg: jpeg, kind: Kind(verdict.Category)}, nil
}

// save puts the object, then the row (under the cap); a refused or failed
// row removes the object again. full reports the cap refusal.
func (s *Service) save(ctx context.Context, userID uuid.UUID, p prepared) (full bool, err error) {
	key := fmt.Sprintf("%s/%s.jpg", userID, uuid.New())
	if err := s.objects.Put(ctx, key, p.jpeg, "image/jpeg"); err != nil {
		return false, fmt.Errorf("store photo: %w", err)
	}
	ok, err := s.store.InsertPhoto(ctx, userID, key, p.kind, caps[p.kind])
	if err != nil || !ok {
		_ = s.objects.Delete(ctx, key) // keep storage in step with the rows
	}
	if err != nil {
		return false, fmt.Errorf("save photo: %w", err)
	}
	return !ok, nil
}

// UploadBodySet adds up to 5 images to the analysis set; moderation sorts
// each into a body photo (max 5 kept) or a report (max 3). Rejections are
// per file; the rest of the batch proceeds.
func (s *Service) UploadBodySet(ctx context.Context, userID uuid.UUID, uploads []Upload) (Uploaded, error) {
	if len(uploads) == 0 {
		return Uploaded{}, apperr.New(apperr.Invalid, "Choose at least one image to upload")
	}
	if len(uploads) > MaxBatch {
		return Uploaded{}, apperr.New(apperr.Invalid, fmt.Sprintf("Upload at most %d images at a time", MaxBatch))
	}
	used, err := s.store.CountPhotos(ctx, userID)
	if err != nil {
		return Uploaded{}, fmt.Errorf("count photos: %w", err)
	}
	var rejected []string
	uploaded, reports := 0, 0
	moderationDown := false
	for _, u := range uploads {
		label := u.Name
		if label == "" {
			label = "image"
		}
		if used[BodyPhoto] >= caps[BodyPhoto] && used[Report] >= caps[Report] {
			rejected = append(rejected, label+": photo and report limits reached")
			continue
		}
		p, err := s.prepare(ctx, u)
		if errors.Is(err, errModerationDown) {
			rejected = append(rejected, label+": "+err.Error())
			moderationDown = true
			break
		}
		if err != nil {
			rejected = append(rejected, label+": "+err.Error())
			continue
		}
		if used[p.kind] >= caps[p.kind] {
			rejected = append(rejected, label+": "+capMessages[p.kind])
			continue
		}
		full, err := s.save(ctx, userID, p)
		if err != nil {
			return Uploaded{}, err
		}
		if full {
			rejected = append(rejected, label+": "+capMessages[p.kind])
			continue
		}
		used[p.kind]++
		uploaded++
		if p.kind == Report {
			reports++
		}
	}
	if uploaded == 0 {
		msg := strings.Join(rejected, " · ")
		if moderationDown && len(rejected) == 1 {
			return Uploaded{}, apperr.New(apperr.Unavailable, msg)
		}
		return Uploaded{}, apperr.New(apperr.Invalid, msg)
	}
	return batchMessage(uploaded, reports, rejected), nil
}

// batchMessage is "2 images uploaded; report metrics can be extracted below; rejected — …".
func batchMessage(uploaded, reports int, rejected []string) Uploaded {
	noun := map[bool]string{true: "image", false: "images"}[uploaded == 1]
	parts := []string{fmt.Sprintf("%d %s uploaded", uploaded, noun)}
	if reports > 0 {
		parts = append(parts, "report metrics can be extracted below")
	}
	status := "success"
	if len(rejected) > 0 {
		parts = append(parts, "rejected — "+strings.Join(rejected, " · "))
		status = "info"
	}
	// A rejection reason may already end the sentence (legacy printed "fine..").
	return Uploaded{Status: status, Message: strings.TrimSuffix(strings.Join(parts, "; "), ".") + "."}
}

// progressFull is the journal's cap message.
var progressFull = fmt.Sprintf("You already have %d progress photos — delete an old one first", MaxProgress)

// progressErrors rewrite prepare's per-file reasons as single-photo copy.
var progressErrors = map[string]string{
	"must be 5MB or smaller":         "Photo must be 5MB or smaller",
	"use a JPEG, PNG, or WebP image": "Use JPEG, PNG, or WebP",
}

// UploadProgress adds one photo to the progress journal (max 24); reports
// belong in the analysis set.
func (s *Service) UploadProgress(ctx context.Context, userID uuid.UUID, uploads []Upload) (string, error) {
	if len(uploads) != 1 {
		return "", apperr.New(apperr.Invalid, "Choose a photo")
	}
	used, err := s.store.CountPhotos(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("count photos: %w", err)
	}
	if used[Progress] >= MaxProgress {
		return "", apperr.New(apperr.Invalid, progressFull)
	}
	p, err := s.prepare(ctx, uploads[0])
	if errors.Is(err, errModerationDown) {
		return "", apperr.New(apperr.Unavailable, err.Error())
	}
	if err != nil {
		if msg, known := progressErrors[err.Error()]; known {
			return "", apperr.New(apperr.Invalid, msg)
		}
		return "", apperr.New(apperr.Invalid, err.Error())
	}
	if p.kind == Report {
		return "", apperr.New(apperr.Invalid, "That looks like a report — upload it in the analysis set instead")
	}
	p.kind = Progress
	full, err := s.save(ctx, userID, p)
	if err != nil {
		return "", err
	}
	if full {
		return "", apperr.New(apperr.Invalid, progressFull)
	}
	return "Progress photo added.", nil
}

// Open streams one of the user's images; the caller closes it.
func (s *Service) Open(ctx context.Context, userID, id uuid.UUID) (io.ReadCloser, int64, error) {
	path, ok, err := s.store.PhotoPath(ctx, userID, id)
	if err != nil {
		return nil, 0, fmt.Errorf("find photo: %w", err)
	}
	if !ok {
		return nil, 0, apperr.New(apperr.NotFound, "Photo not found")
	}
	return s.objects.Get(ctx, path)
}

// Delete removes the row first, then the object: an orphaned object is
// invisible and harmless; a row without its object would be a broken image
// that still counts toward the cap.
func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) (string, error) {
	path, ok, err := s.store.DeletePhoto(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("delete photo: %w", err)
	}
	if !ok {
		return "", apperr.New(apperr.NotFound, "Photo not found")
	}
	_ = s.objects.Delete(ctx, path) // best effort; see above
	return "Photo deleted.", nil
}
