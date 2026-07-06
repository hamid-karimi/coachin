/**
 * Convert a Gemini `responseSchema` into a compact JSON-Schema-like object we
 * can embed in a Claude prompt. Claude (Opus/Sonnet 4.6) has no structured-
 * output enforcement, so we describe the exact shape instead — reusing the
 * single schema each AI module already defines for Gemini (no second schema to
 * keep in sync). Pure + unit-tested.
 */
import type { Schema } from "@google/genai";

// Gemini's Type enum serializes to uppercase ("OBJECT", "STRING", …).
const TYPE_MAP: Record<string, string> = {
  OBJECT: "object",
  ARRAY: "array",
  STRING: "string",
  NUMBER: "number",
  INTEGER: "integer",
  BOOLEAN: "boolean",
};

export function geminiSchemaToHint(schema: Schema): unknown {
  const type = schema.type ? TYPE_MAP[String(schema.type)] ?? "string" : undefined;
  const out: Record<string, unknown> = {};

  if (type) out.type = schema.nullable ? [type, "null"] : type;
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;

  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        geminiSchemaToHint(value as Schema),
      ]),
    );
  }
  if (schema.items) out.items = geminiSchemaToHint(schema.items as Schema);
  if (schema.required?.length) out.required = schema.required;

  return out;
}
