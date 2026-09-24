package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func get(t *testing.T, handler http.Handler, path string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("GET %s: invalid JSON %q: %v", path, rec.Body.String(), err)
	}
	return rec, body
}

func ok(context.Context) error { return nil }

func TestHealthz(t *testing.T) {
	handler, _ := New(Deps{})
	rec, body := get(t, handler, BasePath+"/healthz")
	if rec.Code != http.StatusOK || body["status"] != "ok" {
		t.Fatalf("got %d %v", rec.Code, body)
	}
	if _, hasSchema := body["$schema"]; hasSchema {
		t.Error("responses must not carry a $schema field")
	}
}

func TestReadyzAllHealthy(t *testing.T) {
	handler, _ := New(Deps{Checks: ReadinessChecks{"database": ok, "storage": ok}})
	rec, body := get(t, handler, BasePath+"/readyz")
	if rec.Code != http.StatusOK || body["status"] != "ok" {
		t.Fatalf("got %d %v", rec.Code, body)
	}
}

func TestReadyzReportsEveryFailure(t *testing.T) {
	handler, _ := New(Deps{Checks: ReadinessChecks{
		"database": func(context.Context) error { return errors.New("connection refused") },
		"storage":  ok,
	}})
	rec, body := get(t, handler, BasePath+"/readyz")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	checks := body["checks"].(map[string]any)
	if checks["database"] != "connection refused" || checks["storage"] != "ok" {
		t.Fatalf("checks = %v", checks)
	}
}

func TestOpenAPIServesUnderBasePath(t *testing.T) {
	handler, api := New(Deps{})
	if api.OpenAPI().Paths["/readyz"] == nil {
		t.Fatal("readyz missing from the OpenAPI document")
	}
	rec, body := get(t, handler, BasePath+"/openapi.json")
	if rec.Code != http.StatusOK || body["openapi"] != "3.1.0" {
		t.Fatalf("got %d %v", rec.Code, body["openapi"])
	}
}
