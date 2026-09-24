package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

var request = aigen.Request{
	Prompt:    "Make a plan",
	Schema:    aigen.Schema{Type: aigen.Object, Properties: []aigen.Property{{Name: "summary", Schema: aigen.Schema{Type: aigen.String}}}},
	MaxTokens: 1234,
}

// claudeServer streams a /v1/messages answer with the given stop reason and
// text (server-sent events, as the streaming API sends them).
func claudeServer(t *testing.T, status int, stopReason, text string, seen *map[string]any) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			t.Errorf("claude path %s", r.URL.Path)
		}
		if seen != nil {
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, seen)
		}
		if status != http.StatusOK {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"type":"error","error":{"type":"invalid_request_error","message":"bad"}}`))
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		half := len(text) / 2
		for _, event := range []map[string]any{
			{"type": "message_start", "message": map[string]any{"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-test",
				"content": []any{}, "usage": map[string]any{"input_tokens": 1, "output_tokens": 0}}},
			{"type": "content_block_start", "index": 0, "content_block": map[string]any{"type": "text", "text": ""}},
			{"type": "content_block_delta", "index": 0, "delta": map[string]any{"type": "text_delta", "text": text[:half]}},
			{"type": "content_block_delta", "index": 0, "delta": map[string]any{"type": "text_delta", "text": text[half:]}},
			{"type": "content_block_stop", "index": 0},
			{"type": "message_delta", "delta": map[string]any{"stop_reason": stopReason}, "usage": map[string]any{"output_tokens": 5}},
			{"type": "message_stop"},
		} {
			data, _ := json.Marshal(event)
			_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event["type"], data)
		}
	}))
}

func geminiServer(t *testing.T, text string, calls *atomic.Int32) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if !strings.HasSuffix(r.URL.Path, ":generateContent") {
			t.Errorf("gemini path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []map[string]any{{"content": map[string]any{"role": "model", "parts": []map[string]any{{"text": text}}}}},
		})
	}))
}

func newClient(t *testing.T, cfg Config) *Client {
	t.Helper()
	c, err := New(context.Background(), cfg, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestClaudeFirst(t *testing.T) {
	var seen map[string]any
	claude := claudeServer(t, http.StatusOK, "end_turn", "Sure:\n```json\n{\"summary\":\"ok\"}\n```", &seen)
	defer claude.Close()
	var geminiCalls atomic.Int32
	gemini := geminiServer(t, `{"summary":"gemini"}`, &geminiCalls)
	defer gemini.Close()

	c := newClient(t, Config{ClaudeAPIKey: "k", ClaudeModel: "claude-x", ClaudeBaseURL: claude.URL, GeminiAPIKey: "g", GeminiBaseURL: gemini.URL})
	result, ok := c.GenerateJSON(context.Background(), request)
	if !ok || result.Text != `{"summary":"ok"}` || result.Model != "claude-x" || geminiCalls.Load() != 0 {
		t.Fatalf("result = %+v, %v, gemini calls %d", result, ok, geminiCalls.Load())
	}
	system := seen["system"].([]any)[0].(map[string]any)["text"].(string)
	if !strings.HasSuffix(system, `{"type":"object","properties":{"summary":{"type":"string"}}}`) ||
		seen["max_tokens"].(float64) != 1234 || seen["thinking"].(map[string]any)["type"] != "disabled" || seen["stream"] != true {
		t.Errorf("claude request = %v", seen)
	}
}

func TestFallsBackToGemini(t *testing.T) {
	cases := map[string]*httptest.Server{
		"refusal":  claudeServer(t, http.StatusOK, "refusal", `{"summary":"no"}`, nil),
		"no json":  claudeServer(t, http.StatusOK, "end_turn", "I cannot help with that.", nil),
		"overload": claudeServer(t, http.StatusBadRequest, "", "", nil),
	}
	for name, claude := range cases {
		var calls atomic.Int32
		gemini := geminiServer(t, `{"summary":"gemini"}`, &calls)
		c := newClient(t, Config{ClaudeAPIKey: "k", ClaudeBaseURL: claude.URL, GeminiAPIKey: "g", GeminiBaseURL: gemini.URL})
		result, ok := c.GenerateJSON(context.Background(), request)
		if !ok || result.Text != `{"summary":"gemini"}` || result.Model != DefaultGeminiModel || calls.Load() != 1 {
			t.Errorf("%s: %+v, %v", name, result, ok)
		}
		claude.Close()
		gemini.Close()
	}
}

func TestNoProviders(t *testing.T) {
	if _, ok := newClient(t, Config{}).GenerateJSON(context.Background(), request); ok {
		t.Fatal("no keys must mean unavailable")
	}
}

func TestGeminiSchemaKeepsOrder(t *testing.T) {
	item := aigen.Schema{Type: aigen.String, Nullable: true}
	s := geminiSchema(aigen.Schema{Type: aigen.Object, Properties: []aigen.Property{{Name: "b", Schema: item}, {Name: "a", Schema: item}}, Required: []string{"b"}})
	if strings.Join(s.PropertyOrdering, ",") != "b,a" || !*s.Properties["a"].Nullable || s.Type != "OBJECT" {
		t.Errorf("schema = %+v", s)
	}
}
