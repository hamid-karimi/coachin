/**
 * Server-only Claude client. Never import from client components — the key must
 * stay out of the browser bundle. Claude is the primary text-generation
 * provider; Gemini is the fallback (see text-json.ts).
 *
 * Model 4.6 family has no structured-output enforcement, so callers describe the
 * JSON shape in the prompt and we parse the text (see extract-json.ts).
 */
import Anthropic from "@anthropic-ai/sdk";

// Sonnet 4.6: fast and cost-effective for structured generation, with a 1M
// context window. Swap to `claude-opus-4-6` via CLAUDE_MODEL for max quality.
const DEFAULT_MODEL = "claude-sonnet-4-6";

export function getClaudeModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

export function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/**
 * One-shot JSON generation with Claude. Returns the raw assistant text (the
 * caller extracts/parses/validates), or null when Claude is unavailable or
 * declines. Never throws — a null lets the caller fall back to Gemini.
 */
export async function generateClaudeText(opts: {
  system: string;
  prompt: string;
  images?: { base64: string; mimeType: string }[];
  maxTokens?: number;
}): Promise<string | null> {
  const client = getClaudeClient();
  if (!client) return null;

  const content: Anthropic.ContentBlockParam[] = [
    ...(opts.images ?? []).map(
      (image): Anthropic.ContentBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimeType as Anthropic.Base64ImageSource["media_type"],
          data: image.base64,
        },
      }),
    ),
    { type: "text", text: opts.prompt },
  ];

  try {
    const message = await client.messages.create({
      model: getClaudeModel(),
      max_tokens: opts.maxTokens ?? 16000,
      // These are latency-sensitive, well-scoped generation calls — keep them
      // snappy (no thinking) to match the flash-tier behavior we're replacing.
      thinking: { type: "disabled" },
      system: opts.system,
      messages: [{ role: "user", content }],
    });

    if (message.stop_reason === "refusal") return null;

    const text = message.content
      .filter(
        (block): block is Anthropic.TextBlock => block.type === "text",
      )
      .map((block) => block.text)
      .join("");
    return text || null;
  } catch (error) {
    console.error("Claude generation failed:", error);
    return null;
  }
}
