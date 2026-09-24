import { describe, expect, it } from "vitest";

import {
  isCheckable,
  logWindowOpen,
  planItemDetailLine,
  planItemVisualType,
  planItemTypeLabel,
  planItemVideoUrl,
} from "./plan-items";

describe("planItemDetailLine", () => {
  it("joins distance, pace, and duration", () => {
    expect(
      planItemDetailLine({
        distanceKm: 6,
        paceMinKm: "7:45",
        durationMin: 45,
      }),
    ).toBe("6km · @ 7:45/km · 45min");
  });

  it("omits missing parts", () => {
    expect(planItemDetailLine({ durationMin: 30 })).toBe("30min");
    expect(planItemDetailLine(null)).toBe("");
    expect(planItemDetailLine({})).toBe("");
  });
});

describe("planItemVideoUrl", () => {
  it("builds a YouTube search URL from the video query", () => {
    expect(planItemVideoUrl({ videoQuery: "cat cow stretch" })).toBe(
      "https://www.youtube.com/results?search_query=cat%20cow%20stretch",
    );
  });

  it("returns null when there is no video query", () => {
    expect(planItemVideoUrl(null)).toBeNull();
    expect(planItemVideoUrl({ durationMin: 20 })).toBeNull();
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

describe("planItemVisualType", () => {
  it("shows walk-like recovery as active recovery", () => {
    expect(planItemVisualType({ itemType: "recovery", title: "Easy walk" })).toBe("recovery_active");
    expect(planItemVisualType({ itemType: "recovery", title: "Rest" })).toBe("recovery");
    expect(planItemVisualType({ itemType: "run", title: "Jog" })).toBe("run");
  });
});

describe("isCheckable", () => {
  it("excludes meal notes", () => {
    expect(isCheckable("run")).toBe(true);
    expect(isCheckable("meal_note")).toBe(false);
  });
});

describe("logWindowOpen", () => {
  it("opens on the item's day and the day after", () => {
    expect(logWindowOpen("2026-09-30", "2026-09-29")).toBe(false);
    expect(logWindowOpen("2026-09-30", "2026-09-30")).toBe(true);
    expect(logWindowOpen("2026-09-30", "2026-10-01")).toBe(true);
    expect(logWindowOpen("2026-09-30", "2026-10-02")).toBe(false);
  });
});
