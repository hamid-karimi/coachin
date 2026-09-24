import type { components } from "@/lib/api/schema";

type Proposal = components["schemas"]["CheckinProposalBody"];
type ConfirmBody = components["schemas"]["ConfirmCheckinInputBody"];
type Decision = Proposal["decision"];

export const DECISION_COPY: Record<Decision, { label: string; blurb: string }> = {
  advance: {
    label: "Advance",
    blurb: "Next week progresses as planned, lightly tuned to how this week went.",
  },
  repeat: {
    label: "Repeat the week",
    blurb: "Next week mirrors this week's structure so you can nail it before moving on.",
  },
  deload: {
    label: "Deload",
    blurb: "Next week's volume comes down so you can recover and rebuild momentum.",
  },
};

export type Flag = { text: string; red: boolean };

/** Red flags first, then cautions. */
export function checkinFlags(scorecard: Proposal["scorecard"]): Flag[] {
  return [
    ...scorecard.redFlags.map((text) => ({ text, red: true })),
    ...scorecard.cautionFlags.map((text) => ({ text, red: false })),
  ];
}

/** Confirming posts the proposal back; the API re-scores the week itself. */
export function confirmBody(proposal: Proposal): ConfirmBody {
  return {
    checkinWeek: proposal.reviewWeek,
    summary: proposal.summary,
    items: proposal.items,
  };
}
