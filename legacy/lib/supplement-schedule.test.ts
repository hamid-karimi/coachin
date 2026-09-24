import { describe, expect, it } from "vitest";

import {
  isSupplementDue,
  scheduleLabel,
  type SupplementSchedule,
} from "./supplement-schedule";

describe("isSupplementDue", () => {
  it("daily is always due", () => {
    const schedule: SupplementSchedule = {
      scheduleType: "daily",
      daysOfWeek: null,
    };
    expect(isSupplementDue(schedule, { weekday: 1, isTrainingDay: false })).toBe(
      true,
    );
    expect(isSupplementDue(schedule, { weekday: 6, isTrainingDay: true })).toBe(
      true,
    );
  });

  it("training_days follows the training-day flag", () => {
    const schedule: SupplementSchedule = {
      scheduleType: "training_days",
      daysOfWeek: null,
    };
    expect(isSupplementDue(schedule, { weekday: 2, isTrainingDay: true })).toBe(
      true,
    );
    expect(isSupplementDue(schedule, { weekday: 2, isTrainingDay: false })).toBe(
      false,
    );
  });

  it("custom is due when the weekday is listed", () => {
    const schedule: SupplementSchedule = {
      scheduleType: "custom",
      daysOfWeek: [0, 2, 4],
    };
    expect(isSupplementDue(schedule, { weekday: 2, isTrainingDay: false })).toBe(
      true,
    );
    expect(isSupplementDue(schedule, { weekday: 3, isTrainingDay: true })).toBe(
      false,
    );
  });

  it("custom with an empty or null day list is due (never stranded)", () => {
    expect(
      isSupplementDue(
        { scheduleType: "custom", daysOfWeek: [] },
        { weekday: 3, isTrainingDay: false },
      ),
    ).toBe(true);
    expect(
      isSupplementDue(
        { scheduleType: "custom", daysOfWeek: null },
        { weekday: 3, isTrainingDay: false },
      ),
    ).toBe(true);
  });
});

describe("scheduleLabel", () => {
  it("labels daily and training_days", () => {
    expect(
      scheduleLabel({ scheduleType: "daily", daysOfWeek: null }),
    ).toBe("Every day");
    expect(
      scheduleLabel({ scheduleType: "training_days", daysOfWeek: null }),
    ).toBe("Training days");
  });

  it("lists custom weekdays in Sun→Sat order", () => {
    expect(
      scheduleLabel({ scheduleType: "custom", daysOfWeek: [4, 0, 2] }),
    ).toBe("Sun · Tue · Thu");
    expect(
      scheduleLabel({ scheduleType: "custom", daysOfWeek: [6] }),
    ).toBe("Sat");
  });

  it("treats empty/null custom days as every day", () => {
    expect(
      scheduleLabel({ scheduleType: "custom", daysOfWeek: [] }),
    ).toBe("Every day");
    expect(
      scheduleLabel({ scheduleType: "custom", daysOfWeek: null }),
    ).toBe("Every day");
  });
});
