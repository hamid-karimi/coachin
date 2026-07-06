import { describe, expect, it } from "vitest";

import {
  planItemDetailLine,
  planItemTypeLabel,
  planItemVideoUrl,
} from "./plan-items";

describe("planItemDetailLine", () => {
  it("joins distance, pace, and duration", () => {
    expect(
      planItemDetailLine({
        distance_km: 6,
        pace_min_km: "7:45",
        duration_min: 45,
      }),
    ).toBe("6km · @ 7:45/km · 45min");
  });

  it("omits missing parts", () => {
    expect(planItemDetailLine({ duration_min: 30 })).toBe("30min");
    expect(planItemDetailLine(null)).toBe("");
    expect(planItemDetailLine({})).toBe("");
  });
});

describe("planItemVideoUrl", () => {
  it("builds a YouTube search URL from the video query", () => {
    expect(planItemVideoUrl({ video_query: "cat cow stretch" })).toBe(
      "https://www.youtube.com/results?search_query=cat%20cow%20stretch",
    );
  });

  it("returns null when there is no video query", () => {
    expect(planItemVideoUrl(null)).toBeNull();
    expect(planItemVideoUrl({ duration_min: 20 })).toBeNull();
  });
});

describe("planItemTypeLabel", () => {
  it("maps known item types to friendly labels", () => {
    expect(planItemTypeLabel("run")).toBe("Run");
    expect(planItemTypeLabel("recovery_active")).toBe("Active recovery");
    expect(planItemTypeLabel("meal_note")).toBe("Meal note");
  });

  it("de-underscores and capitalises unknown types", () => {
    expect(planItemTypeLabel("tempo_run")).toBe("Tempo run");
    expect(planItemTypeLabel("brick")).toBe("Brick");
  });

  it("falls back to a generic label for empty input", () => {
    expect(planItemTypeLabel("")).toBe("Session");
  });
});
