package photos

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

var user = uuid.New()

type fakeStore struct {
	counts    map[Kind]int
	rows      map[string]Kind
	full      bool
	deleted   string
	consented bool
	body      []StoredPhoto
	list      []Photo
	saved     map[uuid.UUID]string
}

func (f *fakeStore) RecordConsent(context.Context, uuid.UUID) error {
	f.consented = true
	return nil
}
func (f *fakeStore) Consented(context.Context, uuid.UUID) (bool, error) { return f.consented, nil }
func (f *fakeStore) PathsOfKind(context.Context, uuid.UUID, Kind, int) ([]StoredPhoto, error) {
	return f.body, nil
}
func (f *fakeStore) PhotoPathOfKind(_ context.Context, _, id uuid.UUID, kind Kind) (string, bool, error) {
	return "u/report.jpg", kind == Report && id != uuid.Nil, nil
}
func (f *fakeStore) SaveAnalysis(_ context.Context, _, id uuid.UUID, analysis []byte) error {
	if f.saved == nil {
		f.saved = map[uuid.UUID]string{}
	}
	f.saved[id] = string(analysis)
	return nil
}

func (f *fakeStore) CountPhotos(context.Context, uuid.UUID) (map[Kind]int, error) {
	out := map[Kind]int{}
	for k, v := range f.counts {
		out[k] = v
	}
	return out, nil
}
func (f *fakeStore) InsertPhoto(_ context.Context, _ uuid.UUID, path string, kind Kind, _ int) (bool, error) {
	if f.full {
		return false, nil
	}
	f.rows[path] = kind
	return true, nil
}
func (f *fakeStore) Photos(context.Context, uuid.UUID) ([]Photo, error) { return f.list, nil }
func (f *fakeStore) PhotoPath(_ context.Context, _, id uuid.UUID) (string, bool, error) {
	return "u/" + id.String() + ".jpg", id != uuid.Nil, nil
}
func (f *fakeStore) DeletePhoto(_ context.Context, _, id uuid.UUID) (string, bool, error) {
	f.deleted = id.String()
	return "u/x.jpg", id != uuid.Nil, nil
}

type fakeObjects struct {
	puts, deletes []string
	report        string // what the report object holds
}

func (f *fakeObjects) Put(_ context.Context, key string, _ []byte, contentType string) error {
	if contentType != "image/jpeg" || !strings.HasPrefix(key, user.String()+"/") {
		return errors.New("bad put")
	}
	f.puts = append(f.puts, key)
	return nil
}
func (f *fakeObjects) Get(_ context.Context, key string) (io.ReadCloser, int64, error) {
	data := map[string]string{"u/report.jpg": f.report}[key]
	if data == "" {
		data = "jpeg"
	}
	return io.NopCloser(bytes.NewReader([]byte(data))), int64(len(data)), nil
}
func (f *fakeObjects) Delete(_ context.Context, key string) error {
	f.deletes = append(f.deletes, key)
	return nil
}

// normalizer turns "bad" into an error and anything else into "jpeg:<data>".
type normalizer struct{}

func (normalizer) Normalize(data []byte) ([]byte, error) {
	if string(data) == "bad" {
		return nil, errors.New("unreadable")
	}
	return append([]byte("jpeg:"), data...), nil
}

// ai answers by the image content: "body", "report", "nsfw", "down".
type ai struct{ calls int }

func (a *ai) GenerateJSON(_ context.Context, req aigen.Request) (aigen.Result, bool) {
	a.calls++
	if strings.HasPrefix(req.Prompt, "These are fitness progress photos") {
		return aigen.Result{Text: fmt.Sprintf(`{"build_notes":"Lean (%d photos)","posture_notes":"Upright","training_considerations":["Hips"]}`, len(req.Images))}, true
	}
	if strings.HasPrefix(req.Prompt, "Extract body-composition") {
		answers := map[string]string{"report": `{"weight_kg":72.4,"body_fat_pct":18,"muscle_mass_kg":null,"notes":"InBody"}`, "blank": `{"weight_kg":null,"notes":""}`}
		text, ok := answers[string(req.Images[0].Data)]
		return aigen.Result{Text: text}, ok
	}
	answers := map[string]string{
		"jpeg:body": `{"category":"body_photo","reason":""}`, "jpeg:report": `{"category":"analysis_report","reason":""}`,
		"jpeg:nsfw": `{"category":"rejected_nudity","reason":""}`,
	}
	text, ok := answers[string(req.Images[0].Data)]
	return aigen.Result{Text: text}, ok
}

func upload(name, data string) Upload {
	return Upload{Name: name, Size: int64(len(data)), Data: []byte(data)}
}

func newService(store *fakeStore, objects *fakeObjects, model *ai) *Service {
	if store.rows == nil {
		store.rows = map[string]Kind{}
	}
	return NewService(store, objects, normalizer{}, model)
}

func wantErr(t *testing.T, err error, kind apperr.Kind, message string) {
	t.Helper()
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Kind != kind || appErr.Message != message {
		t.Fatalf("err = %v, want %q", err, message)
	}
}

func TestUploadBodySet(t *testing.T) {
	store, objects, model := &fakeStore{counts: map[Kind]int{BodyPhoto: 4}}, &fakeObjects{}, &ai{}
	got, err := newService(store, objects, model).UploadBodySet(context.Background(), user, []Upload{
		upload("a.jpg", "body"), upload("b.jpg", "body"), // second one is over the 5-photo cap
		upload("scan.png", "report"), upload("x.jpg", "nsfw"), upload("junk.txt", "bad"),
	})
	if err != nil {
		t.Fatal(err)
	}
	want := "2 images uploaded; report metrics can be extracted below; rejected — b.jpg: you already have 5 photos · " +
		"x.jpg: This photo looks too explicit. Sports attire or athletic progress photos are fine. · junk.txt: use a JPEG, PNG, or WebP image."
	if got.Status != "info" || got.Message != want {
		t.Fatalf("got %+v", got)
	}
	if len(objects.puts) != 2 || len(store.rows) != 2 || model.calls != 4 {
		t.Fatalf("puts %v rows %v calls %d", objects.puts, store.rows, model.calls)
	}

	svc := newService(&fakeStore{}, &fakeObjects{}, &ai{})
	_, err = svc.UploadBodySet(context.Background(), user, nil)
	wantErr(t, err, apperr.Invalid, "Choose at least one image to upload")
	_, err = svc.UploadBodySet(context.Background(), user, make([]Upload, 6))
	wantErr(t, err, apperr.Invalid, "Upload at most 5 images at a time")
	_, err = svc.UploadBodySet(context.Background(), user, []Upload{{Name: "big.jpg", Size: MaxUploadBytes + 1}})
	wantErr(t, err, apperr.Invalid, "big.jpg: must be 5MB or smaller")
	_, err = newService(&fakeStore{counts: map[Kind]int{BodyPhoto: 5, Report: 3}}, &fakeObjects{}, &ai{}).
		UploadBodySet(context.Background(), user, []Upload{upload("a.jpg", "body")})
	wantErr(t, err, apperr.Invalid, "a.jpg: photo and report limits reached")

	// Moderation down stops the batch.
	model = &ai{}
	_, err = newService(&fakeStore{}, &fakeObjects{}, model).UploadBodySet(context.Background(), user, []Upload{upload("a.jpg", "down"), upload("b.jpg", "body")})
	wantErr(t, err, apperr.Unavailable, "a.jpg: "+aigen.ModerationUnavailable)
	if model.calls != 1 {
		t.Errorf("batch continued after moderation failed: %d calls", model.calls)
	}

	// A row refused at the cap (race) removes the stored object.
	objects = &fakeObjects{}
	_, err = newService(&fakeStore{full: true}, objects, &ai{}).UploadBodySet(context.Background(), user, []Upload{upload("a.jpg", "body")})
	wantErr(t, err, apperr.Invalid, "a.jpg: you already have 5 photos")
	if len(objects.deletes) != 1 || objects.deletes[0] != objects.puts[0] {
		t.Errorf("orphan object kept: %+v", objects)
	}
}

func TestUploadProgress(t *testing.T) {
	store := &fakeStore{}
	msg, err := newService(store, &fakeObjects{}, &ai{}).UploadProgress(context.Background(), user, []Upload{upload("p.jpg", "body")})
	if err != nil || msg != "Progress photo added." || len(store.rows) != 1 {
		t.Fatalf("%q %v %v", msg, err, store.rows)
	}
	for kind := range store.rows {
		if store.rows[kind] != Progress {
			t.Errorf("stored as %s", store.rows[kind])
		}
	}
	cases := []struct {
		store   *fakeStore
		uploads []Upload
		kind    apperr.Kind
		want    string
	}{
		{&fakeStore{}, nil, apperr.Invalid, "Choose a photo"},
		{&fakeStore{counts: map[Kind]int{Progress: 24}}, []Upload{upload("p.jpg", "body")}, apperr.Invalid, "You already have 24 progress photos — delete an old one first"},
		{&fakeStore{}, []Upload{upload("p.txt", "bad")}, apperr.Invalid, "Use JPEG, PNG, or WebP"},
		{&fakeStore{}, []Upload{{Name: "big", Size: MaxUploadBytes + 1}}, apperr.Invalid, "Photo must be 5MB or smaller"},
		{&fakeStore{}, []Upload{upload("r.jpg", "report")}, apperr.Invalid, "That looks like a report — upload it in the analysis set instead"},
		{&fakeStore{}, []Upload{upload("n.jpg", "nsfw")}, apperr.Invalid, "This photo looks too explicit. Sports attire or athletic progress photos are fine."},
		{&fakeStore{}, []Upload{upload("d.jpg", "down")}, apperr.Unavailable, aigen.ModerationUnavailable},
	}
	for _, c := range cases {
		_, err := newService(c.store, &fakeObjects{}, &ai{}).UploadProgress(context.Background(), user, c.uploads)
		wantErr(t, err, c.kind, c.want)
	}
}

func TestOpenAndDelete(t *testing.T) {
	objects := &fakeObjects{}
	svc := newService(&fakeStore{}, objects, &ai{})
	body, size, err := svc.Open(context.Background(), user, uuid.New())
	if err != nil || size != 4 {
		t.Fatalf("open: %v", err)
	}
	_ = body.Close()
	_, _, err = svc.Open(context.Background(), user, uuid.Nil)
	wantErr(t, err, apperr.NotFound, "Photo not found")
	msg, err := svc.Delete(context.Background(), user, uuid.New())
	if err != nil || msg != "Photo deleted." || len(objects.deletes) != 1 {
		t.Fatalf("delete: %q %v", msg, err)
	}
	_, err = svc.Delete(context.Background(), user, uuid.Nil)
	wantErr(t, err, apperr.NotFound, "Photo not found")
}

func TestBatchMessageEndsOnce(t *testing.T) {
	got := batchMessage(1, 0, []string{"x.jpg: This photo looks too explicit."})
	if got.Message != "1 image uploaded; rejected — x.jpg: This photo looks too explicit." || got.Status != "info" {
		t.Fatalf("got %+v", got)
	}
}

func TestAnalyze(t *testing.T) {
	newest, older := uuid.New(), uuid.New()
	store := &fakeStore{body: []StoredPhoto{{ID: newest, Path: "u/a.jpg"}, {ID: older, Path: "u/b.jpg"}}}
	svc := newService(store, &fakeObjects{}, &ai{})
	_, err := svc.Analyze(context.Background(), user, false)
	wantErr(t, err, apperr.Invalid, "Tick the consent box to run AI analysis")
	msg, err := svc.Analyze(context.Background(), user, true)
	if err != nil || msg != "Body analysis ready." || !store.consented || !strings.Contains(store.saved[newest], "Lean (2 photos)") {
		t.Fatalf("analyze = %q, %v, %+v", msg, err, store)
	}
	_, err = newService(&fakeStore{}, &fakeObjects{}, &ai{}).Analyze(context.Background(), user, true)
	wantErr(t, err, apperr.Invalid, "Upload at least one body photo first")

	// The library shows the newest body photo's analysis only.
	lib, _ := newService(&fakeStore{consented: true, list: []Photo{
		{Kind: Report, Analysis: []byte(`{"weight_kg":70}`)},
		{Kind: BodyPhoto, Analysis: []byte(`{"build_notes":"Lean","posture_notes":"","training_considerations":[]}`)},
	}}, &fakeObjects{}, &ai{}).Library(context.Background(), user)
	if !lib.Consented || lib.Analysis == nil || lib.Analysis.BuildNotes != "Lean" {
		t.Fatalf("library = %+v", lib)
	}
}

func TestExtract(t *testing.T) {
	id := uuid.New()
	store := &fakeStore{}
	m, err := newService(store, &fakeObjects{report: "report"}, &ai{}).Extract(context.Background(), user, id)
	if err != nil || *m.WeightKg != 72.4 || *m.BodyFatPct != 18 || m.MuscleMassKg != nil || !strings.Contains(store.saved[id], "InBody") {
		t.Fatalf("extract = %+v, %v", m, err)
	}
	_, err = newService(&fakeStore{}, &fakeObjects{report: "blank"}, &ai{}).Extract(context.Background(), user, id)
	wantErr(t, err, apperr.Invalid, "Couldn't read weight or body fat from this report — try a clearer photo")
	_, err = newService(&fakeStore{}, &fakeObjects{report: "down"}, &ai{}).Extract(context.Background(), user, id)
	wantErr(t, err, apperr.Unavailable, aigen.ExtractionUnavailable)
	_, err = newService(&fakeStore{}, &fakeObjects{}, &ai{}).Extract(context.Background(), user, uuid.Nil)
	wantErr(t, err, apperr.NotFound, "Report not found")
}
