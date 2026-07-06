/**
 * AI feedback on logged training sessions (adaptive plan Phase 2).
 * Server-only. Rules first, AI second: a deterministic red-flag pre-check
 * runs before the AI call, and the AI can never downgrade its result.
 * Every AI output field is validated before persisting.
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";

export type SessionFeedback = {
  message: string;
  flag: "ok" | "caution" | "red";
};

const FLAGS = ["ok", "caution", "red"] as const;
const SEVERITY: Record<SessionFeedback["flag"], number> = {
  ok: 0,
  caution: 1,
  red: 2,
};

const PAIN_PATTERN = /pain|hurt|injur|schmerz|verletz/i;
const SEVERE_PATTERN = /sharp|severe|stark/i;

/** Deterministic red-flag pre-check — pure, no I/O. Runs BEFORE the AI call. */
export function redFlagPrecheck(
  note: string | null,
  rpe: number | null,
  itemType: string,
): SessionFeedback["flag"] {
  void itemType; // kept for future item-type-aware rules
  if (note && PAIN_PATTERN.test(note)) {
    if ((rpe !== null && rpe >= 8) || SEVERE_PATTERN.test(note)) return "red";
    return "caution";
  }
  if (rpe !== null && rpe >= 9) return "caution";
  return "ok";
}

function maxFlag(
  a: SessionFeedback["flag"],
  b: SessionFeedback["flag"],
): SessionFeedback["flag"] {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export async function generateSessionFeedback(input: {
  itemTitle: string;
  itemType: string;
  planned: Record<string, unknown> | null;
  actual: Record<string, unknown>;
  rpe: number | null;
  note: string | null;
}): Promise<SessionFeedback | { error: string }> {
  const precheck = redFlagPrecheck(input.note, input.rpe, input.itemType);

  const prompt = [
    `An athlete just logged a training session. Give short, supportive feedback.`,
    `Planned session: "${input.itemTitle}" (${input.itemType}). Planned details: ${JSON.stringify(input.planned ?? {})}.`,
    `Actual result: ${JSON.stringify(input.actual)}.`,
    `Perceived effort (RPE 1-10): ${input.rpe ?? "not given"}.`,
    `Athlete's note: ${input.note ?? "none"}.`,
    `Rules:`,
    `- Compare planned vs actual and the effort; at most 2 sentences plus ONE actionable tip.`,
    `- flag: "ok" if all is fine, "caution" if effort/deviation warrants care, "red" if pain or possible injury is indicated.`,
    `- If pain or injury is mentioned, advise easing off and seeing a professional. NEVER diagnose or prescribe medical treatment.`,
  ].join("\n");

  const result = await generateJsonText({
    prompt,
    maxTokens: 1024,
    schema: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING },
        flag: { type: Type.STRING, enum: ["ok", "caution", "red"] },
      },
      required: ["message", "flag"],
    },
  });

  if (!result) {
    return { error: "AI feedback is temporarily unavailable — try again later" };
  }

  try {
    const raw = JSON.parse(result.text) as {
      message?: unknown;
      flag?: unknown;
    };
    const message =
      typeof raw.message === "string" ? raw.message.trim().slice(0, 300) : "";
    if (!message) {
      return { error: "AI returned an unexpected response" };
    }
    const aiFlag = (FLAGS as readonly string[]).includes(String(raw.flag))
      ? (String(raw.flag) as SessionFeedback["flag"])
      : "caution";

    // The AI can never downgrade the deterministic pre-check.
    return { message, flag: maxFlag(precheck, aiFlag) };
  } catch (error) {
    console.error("Session feedback parse failed:", error);
    return {
      error: "AI feedback is temporarily unavailable — try again later",
    };
  }
}
