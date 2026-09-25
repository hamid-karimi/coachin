import { describe, expect, it } from "vitest";
import {
  comparePair,
  photoDayLabel,
  photoMonthLabel,
  photosForm,
  photoUrl,
  toggleCompare,
  uploadLabel,
} from "./photos";

const photo = (id: string, createdAt: string) => ({ id, createdAt });

describe("photos", () => {
  it("builds urls and labels", () => {
    expect(photoUrl("abc")).toBe("/api/v1/photos/abc");
    expect(photoMonthLabel("2026-09-25T10:00:00Z")).toBe("Sep 2026");
    expect(photoDayLabel("2026-09-25T10:00:00Z")).toBe("Sep 25");
    expect(uploadLabel(0)).toBe("Upload");
    expect(uploadLabel(3)).toBe("Upload 3");
  });

  it("builds the multipart form", () => {
    const form = photosForm([new File(["a"], "a.jpg"), new File(["b"], "b.jpg")], "progress");
    expect(form.getAll("photos")).toHaveLength(2);
    expect(form.get("set")).toBe("progress");
  });

  it("picks at most two, oldest on the left", () => {
    expect(toggleCompare([], "a")).toEqual(["a"]);
    expect(toggleCompare(["a", "b"], "c")).toEqual(["b", "c"]);
    expect(toggleCompare(["a", "b"], "a")).toEqual(["b"]);
    const photos = [
      photo("new", "2026-09-20T00:00:00Z"),
      photo("mid", "2026-08-01T00:00:00Z"),
      photo("old", "2026-06-01T00:00:00Z"),
    ];
    expect(comparePair(photos, ["new", "old"])?.map((p) => p.id)).toEqual(["old", "new"]);
    expect(comparePair(photos, ["new"])).toBeNull();
  });
});
