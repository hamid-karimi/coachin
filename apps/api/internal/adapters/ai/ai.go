// Package ai generates structured JSON with Claude (primary) and falls back
// to Gemini's schema-constrained JSON mode when Claude is unconfigured,
// fails, refuses, or answers without parseable JSON (ADR-9, legacy
// lib/ai/text-json.ts).
package ai

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"google.golang.org/genai"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// Default models; CLAUDE_MODEL / GEMINI_MODEL override them.
const (
	DefaultClaudeModel = "claude-sonnet-5"
	DefaultGeminiModel = "gemini-2.5-flash"
)

// callTimeout bounds each provider call, so a slow primary still leaves
// time for the fallback within the server's write timeout.
const callTimeout = 80 * time.Second

// Config selects the providers; an empty key disables that provider.
type Config struct {
	ClaudeAPIKey string
	ClaudeModel  string
	GeminiAPIKey string
	GeminiModel  string
	// Base URLs, for tests only.
	ClaudeBaseURL string
	GeminiBaseURL string
}

// Client is the generation adapter.
type Client struct {
	claude      *anthropic.Client
	claudeModel string
	gemini      *genai.Client
	geminiModel string
	logger      *slog.Logger
}

// New builds the clients for the configured providers.
func New(ctx context.Context, cfg Config, logger *slog.Logger) (*Client, error) {
	c := &Client{claudeModel: cfg.ClaudeModel, geminiModel: cfg.GeminiModel, logger: logger}
	if c.claudeModel == "" {
		c.claudeModel = DefaultClaudeModel
	}
	if c.geminiModel == "" {
		c.geminiModel = DefaultGeminiModel
	}
	if cfg.ClaudeAPIKey != "" {
		opts := []option.RequestOption{option.WithAPIKey(cfg.ClaudeAPIKey), option.WithMaxRetries(1)}
		if cfg.ClaudeBaseURL != "" {
			opts = append(opts, option.WithBaseURL(cfg.ClaudeBaseURL))
		}
		client := anthropic.NewClient(opts...)
		c.claude = &client
	}
	if cfg.GeminiAPIKey != "" {
		cc := &genai.ClientConfig{APIKey: cfg.GeminiAPIKey, Backend: genai.BackendGeminiAPI}
		if cfg.GeminiBaseURL != "" {
			cc.HTTPOptions.BaseURL = cfg.GeminiBaseURL
		}
		client, err := genai.NewClient(ctx, cc)
		if err != nil {
			return nil, err
		}
		c.gemini = client
	}
	return c, nil
}

// GenerateJSON returns the JSON answer, or ok=false when every provider is
// unavailable or failed (the caller shows "temporarily unavailable").
func (c *Client) GenerateJSON(ctx context.Context, req aigen.Request) (aigen.Result, bool) {
	if text, ok := c.claudeJSON(ctx, req); ok {
		return aigen.Result{Text: text, Model: c.claudeModel}, true
	}
	if text, ok := c.geminiJSON(ctx, req); ok {
		return aigen.Result{Text: text, Model: c.geminiModel}, true
	}
	return aigen.Result{}, false
}

// claudeSystem describes the exact JSON shape: the model has no
// structured-output enforcement, so the text is parsed back out.
func claudeSystem(schema aigen.Schema) string {
	return strings.Join([]string{
		"You are Coachin's AI assistant for training and nutrition planning.",
		"Respond with ONLY a single valid JSON value — no prose, no markdown, no code fences.",
		"It must conform exactly to this JSON schema:",
		aigen.Hint(schema),
	}, "\n")
}

func (c *Client) claudeJSON(ctx context.Context, req aigen.Request) (string, bool) {
	if c.claude == nil {
		return "", false
	}
	ctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	maxTokens := int64(req.MaxTokens)
	if maxTokens == 0 {
		maxTokens = 16000
	}
	disabled := anthropic.NewThinkingConfigDisabledParam()
	// Streamed: the SDK requires it for large output ceilings (plans ask
	// for 24k tokens). The events are accumulated into one message.
	stream := c.claude.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     c.claudeModel,
		MaxTokens: maxTokens,
		// Latency-sensitive, well-scoped generation: no extended thinking.
		Thinking: anthropic.ThinkingConfigParamUnion{OfDisabled: &disabled},
		System:   []anthropic.TextBlockParam{{Text: claudeSystem(req.Schema)}},
		Messages: []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(req.Prompt))},
	})
	defer func() { _ = stream.Close() }()
	var message anthropic.Message
	for stream.Next() {
		if err := message.Accumulate(stream.Current()); err != nil {
			c.logger.WarnContext(ctx, "claude stream failed", "error", err)
			return "", false
		}
	}
	if err := stream.Err(); err != nil {
		c.logger.WarnContext(ctx, "claude generation failed", "error", err)
		return "", false
	}
	if message.StopReason == anthropic.StopReasonRefusal {
		c.logger.WarnContext(ctx, "claude declined the request")
		return "", false
	}
	var text strings.Builder
	for _, block := range message.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	return aigen.ExtractJSON(text.String())
}

func (c *Client) geminiJSON(ctx context.Context, req aigen.Request) (string, bool) {
	if c.gemini == nil {
		return "", false
	}
	ctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	response, err := c.gemini.Models.GenerateContent(ctx, c.geminiModel,
		[]*genai.Content{genai.NewContentFromText(req.Prompt, genai.RoleUser)},
		&genai.GenerateContentConfig{ResponseMIMEType: "application/json", ResponseSchema: geminiSchema(req.Schema)},
	)
	if err != nil {
		c.logger.WarnContext(ctx, "gemini generation failed", "error", err)
		return "", false
	}
	text := response.Text()
	if json, ok := aigen.ExtractJSON(text); ok {
		return json, true
	}
	return text, text != ""
}

// geminiSchema converts the domain schema to the SDK's (property order kept).
func geminiSchema(s aigen.Schema) *genai.Schema {
	out := &genai.Schema{Type: genai.Type(s.Type), Description: s.Description, Enum: s.Enum, Required: s.Required}
	if s.Nullable {
		nullable := true
		out.Nullable = &nullable
	}
	if s.Properties != nil {
		out.Properties = make(map[string]*genai.Schema, len(s.Properties))
		for _, p := range s.Properties {
			out.Properties[p.Name] = geminiSchema(p.Schema)
			out.PropertyOrdering = append(out.PropertyOrdering, p.Name)
		}
	}
	if s.Items != nil {
		out.Items = geminiSchema(*s.Items)
	}
	return out
}
