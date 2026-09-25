package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/watchfile"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/activities"
	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

// multipartBody builds an "activities" upload of the named fixtures (or raw bytes).
func multipartBody(t *testing.T, files map[string][]byte) (string, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for name, data := range files {
		part, err := w.CreateFormFile("activities", name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = part.Write(data)
	}
	_ = w.Close()
	return buf.String(), w.FormDataContentType()
}

func TestParseActivitiesRoute(t *testing.T) {
	h, _ := New(Deps{
		Auth:       &fakeAuth{user: uuid.New(), liveToken: "live-token"},
		Activities: activities.NewService(watchfile.New(nil)),
	})
	upload := func(files map[string][]byte) (int, ActivitiesParsedBody, string) {
		body, contentType := multipartBody(t, files)
		rec := send(t, h, http.MethodPost, BasePath+"/activities/parse", body,
			map[string]string{"Cookie": "coachin_session=live-token", "Content-Type": contentType})
		var parsed ActivitiesParsedBody
		_ = json.Unmarshal(rec.Body.Bytes(), &parsed)
		return rec.Code, parsed, rec.Body.String()
	}

	code, parsed, raw := upload(map[string][]byte{
		"run-5k.fit":    golden.ReadFile(t, "testdata/activity/run-5k.fit"),
		"garmin-hr.gpx": golden.ReadFile(t, "testdata/activity/garmin-hr.gpx"),
		"notes.txt":     []byte("hello"),
	})
	if code != http.StatusOK || parsed.Status != "info" || len(parsed.Activities) != 2 ||
		parsed.Message != "2 runs parsed; skipped — notes.txt: could not parse (use .fit or .gpx exports)." {
		t.Fatalf("mixed upload: %d %s", code, raw)
	}

	code, _, raw = upload(map[string][]byte{"big.fit": make([]byte, activities.MaxFileBytes+1)})
	if code != http.StatusBadRequest || !bytes.Contains([]byte(raw), []byte("big.fit: larger than 4MB")) {
		t.Fatalf("oversized: %d %s", code, raw)
	}

	code, _, raw = upload(map[string][]byte{"huge.fit": make([]byte, maxUploadBytes+1)})
	if code != http.StatusUnprocessableEntity || !bytes.Contains([]byte(raw), []byte("request body too large")) {
		t.Fatalf("body over the cap: %d %s", code, raw)
	}
}

type fakeImporter struct{ raw []any }

func (f *fakeImporter) Import(_ context.Context, _ uuid.UUID, raw []any) (string, error) {
	f.raw = raw
	return "Imported 1 run · +60 XP", nil
}

func TestImportActivitiesRoute(t *testing.T) {
	fake := &fakeImporter{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, ActivityImport: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	rec := send(t, h, http.MethodPost, BasePath+"/activities/import",
		`{"activities":[{"date":"2026-09-24","distanceKm":5.02,"durationMin":30,"avgPaceMinKm":5.98,"avgHr":151,"source":"fit"}]}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	got := fake.raw[0].(map[string]any)
	if got["distance_km"] != 5.02 || got["avg_hr"] != 151.0 || got["source"] != "fit" {
		t.Fatalf("sanitize input = %+v", got)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/activities/import", `{"activities":[]}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
}
