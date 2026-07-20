import { describe, expect, it } from "vitest";

import {
  isProgressPhotoDue,
  PROGRESS_PHOTO_NUDGE_DAYS,
} from "./progress-photo-nudge";

const today = new Date("2026-07-20T12:00:00");

function daysAgo(days: number): Date {
  return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("isProgressPhotoDue", () => {
  it("never nudges inactive users, even without any photo", () => {
    expect(
      isProgressPhotoDue({
        currentStreak: 0,
        weekLogCount: 0,
        lastPhotoAt: null,
        today,
      }),
    ).toBe(false);
  });

  it("nudges an active user with no photo yet", () => {
    expect(
      isProgressPhotoDue({
        currentStreak: 3,
        weekLogCount: 0,
        lastPhotoAt: null,
        today,
      }),
    ).toBe(true);
  });

  it("counts this week's logs as activity even without a streak", () => {
    expect(
      isProgressPhotoDue({
        currentStreak: 0,
        weekLogCount: 1,
        lastPhotoAt: null,
        today,
      }),
    ).toBe(true);
  });

  it("stays quiet while the newest photo is within the window", () => {
    expect(
      isProgressPhotoDue({
        currentStreak: 5,
        weekLogCount: 2,
        lastPhotoAt: daysAgo(PROGRESS_PHOTO_NUDGE_DAYS),
        today,
      }),
    ).toBe(false);
  });

  it("nudges once the newest photo is older than the window", () => {
    expect(
      isProgressPhotoDue({
        currentStreak: 5,
        weekLogCount: 2,
        lastPhotoAt: daysAgo(PROGRESS_PHOTO_NUDGE_DAYS + 1),
        today,
      }),
    ).toBe(true);
  });
});
