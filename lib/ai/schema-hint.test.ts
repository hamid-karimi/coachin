import { describe, expect, it } from "vitest";
import { Type } from "@google/genai";

import { geminiSchemaToHint } from "./schema-hint";

describe("geminiSchemaToHint", () => {
  it("maps Gemini types to lowercase JSON-schema types", () => {
    expect(geminiSchemaToHint({ type: Type.STRING })).toEqual({
      type: "string",
    });
    expect(geminiSchemaToHint({ type: Type.NUMBER })).toEqual({
      type: "number",
    });
  });

  it("renders objects with properties and required", () => {
    const hint = geminiSchemaToHint({
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        age: { type: Type.INTEGER },
      },
      required: ["name"],
    });
    expect(hint).toEqual({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "integer" } },
      required: ["name"],
    });
  });

  it("renders arrays with item shape", () => {
    expect(
      geminiSchemaToHint({ type: Type.ARRAY, items: { type: Type.STRING } }),
    ).toEqual({ type: "array", items: { type: "string" } });
  });

  it("expresses nullable as a type union", () => {
    expect(
      geminiSchemaToHint({ type: Type.NUMBER, nullable: true }),
    ).toEqual({ type: ["number", "null"] });
  });

  it("carries enum and description through", () => {
    expect(
      geminiSchemaToHint({
        type: Type.STRING,
        enum: ["a", "b"],
        description: "a letter",
      }),
    ).toEqual({ type: "string", enum: ["a", "b"], description: "a letter" });
  });
});
