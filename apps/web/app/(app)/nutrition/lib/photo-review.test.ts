import { describe, expect, it } from "vitest";
import { foodToReviewItem, photoForm, reviewReducer, reviewTotal, saveLabel, type ReviewItem } from "./photo-review";

const estimate = {
  name: "Rice",
  estQuantityG: 180,
  estKcal: 230,
  proteinG: 4,
  carbsG: 50,
  fatG: 0,
  sugarG: 0,
  fiberG: 1,
  sodiumMg: 2,
};

describe("photo review", () => {
  it("opens, edits, extends, and discards a review", () => {
    let state = reviewReducer(null, { type: "estimate", items: [estimate] });
    expect(state?.[0].source).toBe("photo");
    state = reviewReducer(state, { type: "update", index: 0, patch: { estKcal: 250, name: "Basmati rice" } });
    state = reviewReducer(state, { type: "append", item: { ...estimate, name: "Oil", estKcal: 90, source: "search" } });
    expect(state?.map((i) => [i.name, i.estKcal])).toEqual([
      ["Basmati rice", 250],
      ["Oil", 90],
    ]);
    expect(reviewTotal(state as ReviewItem[])).toBe(340);
    state = reviewReducer(state, { type: "remove", index: 0 });
    expect(state).toHaveLength(1);
    expect(reviewReducer(state, { type: "discard" })).toBeNull();
    expect(reviewReducer(null, { type: "update", index: 0, patch: {} })).toBeNull();
  });

  it("turns a searched food into a whole-number row", () => {
    const per100g = { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, sugarG: 0, fiberG: 0, sodiumMg: 2 };
    const item = foodToReviewItem(
      { kind: "local", food: { id: "f", name: "Olive oil", source: "seed", per100g } },
      13.5,
    );
    expect(item).toEqual({
      name: "Olive oil",
      estQuantityG: 14,
      estKcal: 119,
      proteinG: 0,
      carbsG: 0,
      fatG: 14,
      sugarG: 0,
      fiberG: 0,
      sodiumMg: 0,
      source: "search",
    });
  });

  it("labels and packs the upload", () => {
    expect(saveLabel(1)).toBe("Save 1 item");
    expect(saveLabel(3)).toBe("Save 3 items");
    const form = photoForm([new File(["a"], "a.jpg"), new File(["b"], "b.jpg")], "  big bowl ");
    expect(form.getAll("photos")).toHaveLength(2);
    expect(form.get("context")).toBe("big bowl");
  });
});
