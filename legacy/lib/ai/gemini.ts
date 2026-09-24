/**
 * Server-only Gemini client (roadmap branches 3-5). Never import from client
 * components — the key must stay out of the browser bundle.
 *
 * SDK facts verified against the installed @google/genai types:
 * ai.models.generateContent, inlineData image parts, safetySettings with
 * HARM_CATEGORY_SEXUALLY_EXPLICIT, responseMimeType + responseSchema.
 */
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

const getModel = getGeminiModel;
const getClient = getGeminiClient;

/** Strict thresholds for anything that handles user photos. */
const STRICT_SAFETY = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

export type ModerationResult =
  | { ok: true; category: "body_photo" | "analysis_report" }
  | { ok: false; reason: string }
  | { ok: false; reason: string; unavailable: true };

/**
 * Pre-storage moderation gate. Policy: sports attire / athletic progress
 * photos and body-analysis reports are accepted; explicit nudity or
 * unrelated content is rejected. Runs BEFORE anything touches storage.
 */
export async function moderateBodyImage(
  base64: string,
  mimeType: string,
): Promise<ModerationResult> {
  const client = getClient();
  if (!client) {
    return {
      ok: false,
      reason: "AI moderation is not configured (missing GEMINI_API_KEY)",
      unavailable: true,
    };
  }

  try {
    const response = await client.models.generateContent({
      model: getModel(),
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: [
                "Classify this image for a fitness app's body-progress feature.",
                "Categories:",
                "- body_photo: a person in sports attire or an athletic progress photo (shirtless athletic torso is acceptable)",
                "- analysis_report: a body-composition report, scan printout, or medical-style document",
                "- rejected_nudity: explicit nudity, exposed genitals or nipples presented sexually, underwear-only in a non-athletic context",
                "- rejected_other: unrelated to fitness bodies or reports (memes, screenshots, food, etc.)",
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        safetySettings: STRICT_SAFETY,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: [
                "body_photo",
                "analysis_report",
                "rejected_nudity",
                "rejected_other",
              ],
            },
            reason: { type: Type.STRING },
          },
          required: ["category", "reason"],
        },
      },
    });

    if (response.promptFeedback?.blockReason) {
      return { ok: false, reason: "Image was blocked by the safety filter" };
    }

    const parsed = JSON.parse(response.text ?? "{}") as {
      category?: string;
      reason?: string;
    };

    if (parsed.category === "body_photo" || parsed.category === "analysis_report") {
      return { ok: true, category: parsed.category };
    }
    if (parsed.category === "rejected_nudity") {
      return {
        ok: false,
        reason:
          "This photo looks too explicit. Sports attire or athletic progress photos are fine.",
      };
    }
    return {
      ok: false,
      reason: "This doesn't look like a body progress photo or analysis report.",
    };
  } catch (error) {
    console.error("Gemini moderation failed:", error);
    return {
      ok: false,
      reason: "AI moderation is temporarily unavailable — try again later",
      unavailable: true,
    };
  }
}

export type BodyAnalysis = {
  build_notes: string;
  posture_notes: string;
  training_considerations: string[];
};

/** Combined observations across up to 5 approved photos (one API call). */
export async function analyzeBodyPhotos(
  images: { base64: string; mimeType: string }[],
): Promise<BodyAnalysis | { error: string }> {
  const client = getClient();
  if (!client) return { error: "AI analysis is not configured" };

  try {
    const response = await client.models.generateContent({
      model: getModel(),
      contents: [
        {
          role: "user",
          parts: [
            ...images.map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.base64 },
            })),
            {
              text: [
                "These are fitness progress photos of one person (with their consent).",
                "Give practical observations to personalize a training program and diet:",
                "build_notes (general build, 1-2 sentences), posture_notes (visible posture",
                "observations, 1-2 sentences), training_considerations (2-4 short bullets).",
                "Do NOT estimate body-fat percentages or diagnose anything medical.",
              ].join(" "),
            },
          ],
        },
      ],
      config: {
        safetySettings: STRICT_SAFETY,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            build_notes: { type: Type.STRING },
            posture_notes: { type: Type.STRING },
            training_considerations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["build_notes", "posture_notes", "training_considerations"],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? "{}") as Partial<BodyAnalysis>;
    if (
      typeof parsed.build_notes !== "string" ||
      typeof parsed.posture_notes !== "string" ||
      !Array.isArray(parsed.training_considerations)
    ) {
      return { error: "AI returned an unexpected response — try again" };
    }
    return parsed as BodyAnalysis;
  } catch (error) {
    console.error("Gemini body analysis failed:", error);
    return { error: "AI analysis is temporarily unavailable — try again later" };
  }
}

export type ReportMetrics = {
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  notes: string;
};

/** Extract structured metrics from a body-analysis report photo. */
export async function extractReportMetrics(
  base64: string,
  mimeType: string,
): Promise<ReportMetrics | { error: string }> {
  const client = getClient();
  if (!client) return { error: "AI analysis is not configured" };

  try {
    const response = await client.models.generateContent({
      model: getModel(),
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: "Extract body-composition metrics from this report image. Use null for anything not clearly readable. Convert to metric units (kg, %).",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weight_kg: { type: Type.NUMBER, nullable: true },
            body_fat_pct: { type: Type.NUMBER, nullable: true },
            muscle_mass_kg: { type: Type.NUMBER, nullable: true },
            notes: { type: Type.STRING },
          },
          required: ["notes"],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? "{}") as Partial<ReportMetrics>;
    return {
      weight_kg: typeof parsed.weight_kg === "number" ? parsed.weight_kg : null,
      body_fat_pct:
        typeof parsed.body_fat_pct === "number" ? parsed.body_fat_pct : null,
      muscle_mass_kg:
        typeof parsed.muscle_mass_kg === "number" ? parsed.muscle_mass_kg : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch (error) {
    console.error("Gemini report extraction failed:", error);
    return { error: "AI extraction is temporarily unavailable — try again later" };
  }
}
