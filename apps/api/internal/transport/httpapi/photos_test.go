package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/photos"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

type fakePhotos struct {
	set     string
	uploads []photos.Upload
}

func (f *fakePhotos) UploadBodySet(_ context.Context, _ uuid.UUID, uploads []photos.Upload) (photos.Uploaded, error) {
	f.set, f.uploads = "body", uploads
	return photos.Uploaded{Status: "info", Message: "1 image uploaded; rejected — b.jpg: must be 5MB or smaller."}, nil
}
func (f *fakePhotos) UploadProgress(_ context.Context, _ uuid.UUID, uploads []photos.Upload) (string, error) {
	f.set, f.uploads = "progress", uploads
	return "Progress photo added.", nil
}
func (f *fakePhotos) Library(context.Context, uuid.UUID) (photos.Library, error) {
	now := time.Now()
	return photos.Library{
		Photos:    []photos.Photo{{ID: uuid.New(), Kind: photos.Progress, CreatedAt: now}, {ID: uuid.New(), Kind: photos.Report, CreatedAt: now}},
		Analysis:  &aigen.BodyAnalysis{BuildNotes: "Lean", TrainingConsiderations: []string{"Hips"}},
		Consented: true,
	}, nil
}
func (f *fakePhotos) Analyze(_ context.Context, _ uuid.UUID, consent bool) (string, error) {
	if !consent {
		return "", apperr.New(apperr.Invalid, "Tick the consent box to run AI analysis")
	}
	return "Body analysis ready.", nil
}
func (f *fakePhotos) Extract(context.Context, uuid.UUID, uuid.UUID) (aigen.ReportMetrics, error) {
	w := 72.4
	return aigen.ReportMetrics{WeightKg: &w, Notes: "InBody"}, nil
}
func (f *fakePhotos) Open(_ context.Context, _, id uuid.UUID) (io.ReadCloser, int64, error) {
	if id == uuid.Nil {
		return nil, 0, apperr.New(apperr.NotFound, "Photo not found")
	}
	return io.NopCloser(bytes.NewReader([]byte("\xff\xd8jpeg"))), 6, nil
}
func (f *fakePhotos) Delete(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "Photo deleted.", nil
}

func photoForm(t *testing.T, set string, files map[string]string) (string, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for name, data := range files {
		part, _ := w.CreateFormFile("photos", name)
		_, _ = part.Write([]byte(data))
	}
	if set != "" {
		_ = w.WriteField("set", set)
	}
	_ = w.Close()
	return buf.String(), w.FormDataContentType()
}

func TestPhotoRoutes(t *testing.T) {
	fake := &fakePhotos{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Photos: fake})
	headers := func(contentType string) map[string]string {
		return map[string]string{"Cookie": "coachin_session=live-token", "Content-Type": contentType}
	}

	body, contentType := photoForm(t, "", map[string]string{"a.jpg": "img-a"})
	rec := send(t, h, http.MethodPost, BasePath+"/photos", body, headers(contentType))
	var res ResultBody
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if rec.Code != http.StatusCreated || fake.set != "body" || string(fake.uploads[0].Data) != "img-a" || res.Status != "info" {
		t.Fatalf("body set: %d %s", rec.Code, rec.Body)
	}
	body, contentType = photoForm(t, "progress", map[string]string{"p.jpg": "img-p"})
	rec = send(t, h, http.MethodPost, BasePath+"/photos", body, headers(contentType))
	if rec.Code != http.StatusCreated || fake.set != "progress" || fake.uploads[0].Name != "p.jpg" {
		t.Fatalf("progress: %d %s", rec.Code, rec.Body)
	}

	rec = send(t, h, http.MethodGet, BasePath+"/photos", "", headers(""))
	var list PhotosBody
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if rec.Code != http.StatusOK || len(list.Progress) != 1 || len(list.Reports) != 1 || list.BodyPhotos == nil ||
		!list.Consented || list.Analysis.BuildNotes != "Lean" {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}

	rec = send(t, h, http.MethodGet, BasePath+"/photos/"+uuid.NewString(), "", headers(""))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/jpeg" || rec.Header().Get("Cache-Control") != photoCacheControl ||
		rec.Body.String() != "\xff\xd8jpeg" {
		t.Fatalf("stream: %d %v %q", rec.Code, rec.Header(), rec.Body)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/photos/"+uuid.Nil.String(), "", headers("")); rec.Code != http.StatusNotFound {
		t.Fatalf("missing photo: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/photos/"+uuid.NewString(), "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/photos/"+uuid.NewString(), "", headers("")); rec.Code != http.StatusOK {
		t.Fatalf("delete: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/photos/analyze", `{"consent":false}`, headers("application/json")); rec.Code != http.StatusBadRequest {
		t.Fatalf("analyze without consent: %d", rec.Code)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/photos/"+uuid.NewString()+"/extract", "", headers(""))
	var metrics ReportMetricsBody
	_ = json.Unmarshal(rec.Body.Bytes(), &metrics)
	if rec.Code != http.StatusOK || *metrics.WeightKg != 72.4 || metrics.BodyFatPct != nil || metrics.Status != "info" {
		t.Fatalf("extract: %d %s", rec.Code, rec.Body)
	}
}
