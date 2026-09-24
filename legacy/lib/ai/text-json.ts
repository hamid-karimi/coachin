/**
 * Provider-agnostic JSON text generation. Claude is the primary provider;
 * Gemini is the automatic fallback when Claude is unconfigured, errors, refuses,
 * or returns unparseable output. Callers keep owning their prompt, their Gemini
 * `responseSchema`, and their own parse/validation of the returned string.
 *
 * Server-only — pulls both provider keys from the environment.
 */
import type { Schema } from "@google/genai";

import { generateClaudeText, getClaudeModel } from "./claude";
import { getGeminiClient, getGeminiModel } from "./gemini";
import { extractJson } from "./extract-json";
import { geminiSchemaToHint } from "./schema-hint";

export type JsonGenRequest = {
  /** The full instruction + context prompt (unchanged from the Gemini call). */
  prompt: string;
  /** The shape both providers must return — reused for Gemini and Claude. */
  schema: Schema;
  /** Optional image parts for vision prompts. */
  images?: { base64: string; mimeType: string }[];
  /** Output ceiling; defaults to 16000 (safe for non-streaming). */
  maxTokens?: number;
};

export type JsonGenResult = {
  /** Raw JSON string, for the caller to parse + validate. */
  text: string;
  /** The provider model that actually produced the response. */
  model: string;
};

/**
 * Returns the generated JSON plus which model produced it, or null when BOTH
 * providers are unavailable/failed. The caller treats null as "AI is
 * temporarily unavailable".
 */
export async function generateJsonText(
  req: JsonGenRequest,
): Promise<JsonGenResult | null> {
  // 1) Primary: Claude. Describe the exact JSON shape (no structured-output
  //    enforcement on the 4.6 family) and parse the text back out.
  const claudeSystem = [
    "You are Coachin's AI assistant for training and nutrition planning.",
    "Respond with ONLY a single valid JSON value — no prose, no markdown, no code fences.",
    "It must conform exactly to this JSON schema:",
    JSON.stringify(geminiSchemaToHint(req.schema)),
  ].join("\n");

  const claudeText = await generateClaudeText({
    system: claudeSystem,
    prompt: req.prompt,
    images: req.images,
    maxTokens: req.maxTokens,
  });
  const claudeJson = extractJson(claudeText);
  if (claudeJson) return { text: claudeJson, model: getClaudeModel() };

  // 2) Fallback: Gemini, using its native schema-constrained JSON mode.
  const gemini = getGeminiClient();
  if (!gemini) return null;
  try {
    const response = await gemini.models.generateContent({
      model: getGeminiModel(),
      contents: [
        {
          role: "user",
          parts: [
            ...(req.images ?? []).map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.base64 },
            })),
            { text: req.prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: req.schema,
      },
    });
    const geminiJson = extractJson(response.text) ?? response.text ?? null;
    return geminiJson ? { text: geminiJson, model: getGeminiModel() } : null;
  } catch (error) {
    console.error("Gemini fallback generation failed:", error);
    return null;
  }
}
