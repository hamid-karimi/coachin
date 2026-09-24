import { serverApi } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

export type CheckinProposal = components["schemas"]["CheckinProposalBody"];

/**
 * The check-in page's proposal. The AI answer is fetched once here and passed
 * down, never refetched in the browser (each fetch is a new AI call). null
 * when no check-in is due for the plan (or the id is malformed).
 */
export async function getCheckinProposal(planId: string): Promise<CheckinProposal | null> {
  const api = await serverApi();
  const { data, response } = await api.GET("/training/plans/{id}/checkin", {
    params: { path: { id: planId } },
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!data) throw new Error(`GET /training/plans/{id}/checkin failed: ${response.status}`);
  return data;
}
