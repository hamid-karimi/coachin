# AI providers

Server-only AI helpers. **Claude is the primary provider; Gemini is the automatic fallback.**

## Text / JSON generation

All structured-JSON generators (training plans, meal plans, meal-photo
estimation, session feedback, weekly adjustments) go through
[`text-json.ts`](./text-json.ts) → `generateJsonText({ prompt, schema, images?, maxTokens? })`:

1. **Claude first** ([`claude.ts`](./claude.ts)) — the shared `schema` (a Gemini
   `responseSchema`) is converted to a JSON-Schema hint
   ([`schema-hint.ts`](./schema-hint.ts)) and embedded in the system prompt,
   since the 4.6 model family has no structured-output enforcement. The response
   text is parsed out with [`extract-json.ts`](./extract-json.ts) (tolerates
   code fences / surrounding prose).
2. **Gemini fallback** — if Claude is unconfigured (`CLAUDE_API_KEY` unset),
   errors, refuses, or returns unparseable output, the same prompt + schema runs
   through Gemini's native schema-constrained JSON mode.

`generateJsonText` returns `{ text, model }` (which model actually answered, for
storing on generated plans) or `null` when both providers fail. Callers own
their own `JSON.parse` + validation.

Each module keeps **one** schema (the Gemini `Schema`); it drives both providers,
so there's no second schema to keep in sync.

## Config

- `CLAUDE_API_KEY` — enables Claude (primary). `CLAUDE_MODEL` overrides the
  default `claude-sonnet-4-6` (e.g. `claude-opus-4-6`).
- `GEMINI_API_KEY` — enables Gemini (fallback). `GEMINI_MODEL` overrides the
  default `gemini-2.5-flash`.

If only one key is set, that provider is used. If neither is set, generators
return an "AI is temporarily unavailable" error.

## Image moderation (Gemini-only)

`moderateBodyImage`, `analyzeBodyPhotos`, and `extractReportMetrics` in
[`gemini.ts`](./gemini.ts) stay on Gemini — they depend on Gemini's explicit-
content safety classifier, which is the point of the pre-storage moderation gate.
