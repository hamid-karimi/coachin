package httpapi

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/photos"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// PhotoService is the body / progress photo use cases.
type PhotoService interface {
	UploadBodySet(ctx context.Context, userID uuid.UUID, uploads []photos.Upload) (photos.Uploaded, error)
	UploadProgress(ctx context.Context, userID uuid.UUID, uploads []photos.Upload) (string, error)
	Library(ctx context.Context, userID uuid.UUID) (photos.Library, error)
	Analyze(ctx context.Context, userID uuid.UUID, consent bool) (string, error)
	Extract(ctx context.Context, userID, id uuid.UUID) (aigen.ReportMetrics, error)
	Open(ctx context.Context, userID, id uuid.UUID) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, userID, id uuid.UUID) (string, error)
}

// PhotoBody is one stored image; its bytes are at GET /photos/{id}.
type PhotoBody struct {
	ID        uuid.UUID `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
}

// BodyAnalysisBody is the AI's read of the analysis set.
type BodyAnalysisBody struct {
	BuildNotes             string   `json:"buildNotes"`
	PostureNotes           string   `json:"postureNotes"`
	TrainingConsiderations []string `json:"trainingConsiderations"`
}

// PhotosBody is the user's images by kind (newest first), the latest body
// analysis, and whether they consented to AI analysis.
type PhotosBody struct {
	BodyPhotos []PhotoBody       `json:"bodyPhotos" doc:"The AI analysis set (max 5)"`
	Reports    []PhotoBody       `json:"reports" doc:"Body-composition report photos (max 3)"`
	Progress   []PhotoBody       `json:"progress" doc:"The progress journal (max 24)"`
	Analysis   *BodyAnalysisBody `json:"analysis,omitempty" doc:"On the newest analyzed body photo; fed to the plan prompts"`
	Consented  bool              `json:"consented" doc:"AI photo analysis consent was given"`
}

type analyzeInput struct {
	Body struct {
		Consent bool `json:"consent" doc:"Must be true: the user agrees to AI analysis of their photos"`
	}
}

// ReportMetricsBody is what a report photo says; nothing is saved as a
// measurement until the user confirms it.
type ReportMetricsBody struct {
	ResultBody
	WeightKg     *float64 `json:"weightKg"`
	BodyFatPct   *float64 `json:"bodyFatPct"`
	MuscleMassKg *float64 `json:"muscleMassKg"`
	Notes        string   `json:"notes"`
}

type reportMetricsOutput struct {
	Body ReportMetricsBody
}

type photosOutput struct {
	Body PhotosBody
}

type photoFiles struct {
	Photos []huma.FormFile `form:"photos" doc:"JPEG, PNG, or WebP; up to 5 files of 5 MB (progress: exactly 1)"`
	Set    string          `form:"set" enum:"body,progress" required:"false" doc:"body (analysis set; the default) or progress (journal)"`
}

type uploadPhotosInput struct {
	RawBody huma.MultipartFormFiles[photoFiles]
}

// maxPhotoUploadBytes caps the multipart body: five 5 MB files plus room
// for an oversized one to be reported rather than cut off.
const maxPhotoUploadBytes = 32 << 20

// photoCacheControl: an id is never reused for other bytes, so a photo can
// be cached for good — but only by this browser.
const photoCacheControl = "private, max-age=31536000, immutable"

func photosBody(lib photos.Library) PhotosBody {
	body := PhotosBody{BodyPhotos: []PhotoBody{}, Reports: []PhotoBody{}, Progress: []PhotoBody{}, Consented: lib.Consented}
	if a := lib.Analysis; a != nil {
		body.Analysis = &BodyAnalysisBody{BuildNotes: a.BuildNotes, PostureNotes: a.PostureNotes, TrainingConsiderations: a.TrainingConsiderations}
	}
	groups := map[photos.Kind]*[]PhotoBody{photos.BodyPhoto: &body.BodyPhotos, photos.Report: &body.Reports, photos.Progress: &body.Progress}
	for _, p := range lib.Photos {
		if group, ok := groups[p.Kind]; ok {
			*group = append(*group, PhotoBody{ID: p.ID, CreatedAt: p.CreatedAt})
		}
	}
	return body
}

// readUploads reads each file, leaving Data nil for oversized ones (reported
// per file by the use case).
func readUploads(files []huma.FormFile) ([]photos.Upload, error) {
	uploads := make([]photos.Upload, len(files))
	for i, f := range files {
		uploads[i] = photos.Upload{Name: f.Filename, Size: f.Size}
		if f.Size > photos.MaxUploadBytes || len(files) > photos.MaxBatch {
			continue
		}
		data, err := io.ReadAll(io.LimitReader(f, photos.MaxUploadBytes+1))
		if err != nil {
			return nil, err
		}
		uploads[i].Data = data
	}
	return uploads, nil
}

func registerPhotos(api huma.API, deps Deps) {
	svc, logger := deps.Photos, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"photos"}

	huma.Register(api, huma.Operation{
		OperationID: "uploadPhotos", Method: http.MethodPost, Path: "/photos",
		Summary: "Upload body photos / reports (up to 5) or one progress photo",
		Description: "Each image is re-encoded (EXIF and location dropped, ≤1600 px JPEG) and checked by AI before " +
			"anything is stored; rejected files are reported per file.",
		Tags: tags, DefaultStatus: http.StatusCreated,
		Middlewares: huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 6)), limitBody(maxPhotoUploadBytes)},
		Errors:      []int{400, 401, 422, 429, 502},
	}, func(ctx context.Context, in *uploadPhotosInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		form := in.RawBody.Data()
		uploads, err := readUploads(form.Photos)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		if form.Set == "progress" {
			msg, err := svc.UploadProgress(ctx, userID, uploads)
			if err != nil {
				return nil, toProblem(ctx, logger, err)
			}
			return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}, nil
		}
		uploaded, err := svc.UploadBodySet(ctx, userID, uploads)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: uploaded.Status, Message: uploaded.Message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listPhotos", Method: http.MethodGet, Path: "/photos",
		Summary: "The user's body photos, reports, and progress photos", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*photosOutput, error) {
		userID, _ := userFrom(ctx)
		lib, err := svc.Library(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &photosOutput{Body: photosBody(lib)}, nil
	})

	aiLimited := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(20*time.Second, 3))}

	huma.Register(api, huma.Operation{
		OperationID: "analyzePhotos", Method: http.MethodPost, Path: "/photos/analyze",
		Summary:     "AI observations from your body photos (consent required)",
		Description: "Records consent the first time, reads the newest 5 body photos in one call, and stores the result on the newest. Not medical advice.",
		Tags:        tags, Middlewares: aiLimited, Errors: []int{400, 401, 429, 502},
	}, func(ctx context.Context, in *analyzeInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.Analyze(ctx, userID, in.Body.Consent)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "extractReport", Method: http.MethodPost, Path: "/photos/{id}/extract",
		Summary: "Read weight / body fat from a report photo (to confirm as a measurement)",
		Tags:    tags, Middlewares: aiLimited, Errors: []int{400, 401, 404, 429, 502},
	}, func(ctx context.Context, in *idPathInput) (*reportMetricsOutput, error) {
		userID, _ := userFrom(ctx)
		m, err := svc.Extract(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &reportMetricsOutput{Body: ReportMetricsBody{
			ResultBody: ResultBody{Status: "info", Message: "Metrics extracted — review and save below."},
			WeightKg:   m.WeightKg, BodyFatPct: m.BodyFatPct, MuscleMassKg: m.MuscleMassKg, Notes: m.Notes,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getPhoto", Method: http.MethodGet, Path: "/photos/{id}",
		Summary:     "Stream one of your photos (JPEG)",
		Description: "Storage is private; the API checks ownership and streams the bytes.",
		Tags:        tags, Middlewares: signedIn, Errors: []int{401, 404},
		Responses: map[string]*huma.Response{"200": {
			Description: "The photo",
			Content:     map[string]*huma.MediaType{"image/jpeg": {Schema: &huma.Schema{Type: "string", Format: "binary"}}},
		}},
	}, func(ctx context.Context, in *idPathInput) (*huma.StreamResponse, error) {
		userID, _ := userFrom(ctx)
		body, size, err := svc.Open(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &huma.StreamResponse{Body: func(hctx huma.Context) {
			defer func() { _ = body.Close() }()
			hctx.SetHeader("Content-Type", "image/jpeg")
			hctx.SetHeader("Cache-Control", photoCacheControl)
			hctx.SetHeader("X-Content-Type-Options", "nosniff")
			if size > 0 {
				hctx.SetHeader("Content-Length", strconv.FormatInt(size, 10))
			}
			if _, err := io.Copy(hctx.BodyWriter(), body); err != nil {
				logger.WarnContext(ctx, "photo stream interrupted", "error", err)
			}
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deletePhoto", Method: http.MethodDelete, Path: "/photos/{id}",
		Summary: "Delete a photo (row and stored image)", Tags: tags, Middlewares: signedIn, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.Delete(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "info", Message: msg}}, nil
	})
}
