import { describe, expect, it } from "vitest";
import { checkinFlags, confirmBody } from "./checkin";

const proposal = {
  planId: "p1",
  reviewWeek: 3,
  targetWeek: 4,
  decision: "deload" as const,
  reasons: ["A session was red-flagged"],
  summary: "Easier week.",
  scorecard: {
    adherencePct: 80,
    plannedItems: 5,
    completedItems: 4,
    plannedKm: 30,
    actualKm: 28.5,
    redFlags: ["Knee pain"],
    cautionFlags: ["squat: same load 3 weeks running"],
  },
  items: [
    {
      dayOfWeek: 2,
      itemType: "run" as const,
      title: "Easy 5k",
      details: { distanceKm: 5 },
    },
  ],
};

describe("checkinFlags", () => {
  it("lists red flags before cautions", () => {
    expect(checkinFlags(proposal.scorecard)).toEqual([
      { text: "Knee pain", red: true },
      { text: "squat: same load 3 weeks running", red: false },
    ]);
  });
});

describe("confirmBody", () => {
  it("posts the reviewed week, summary, and items back", () => {
    expect(confirmBody(proposal)).toEqual({
      checkinWeek: 3,
      summary: "Easier week.",
      items: proposal.items,
    });
  });
});
