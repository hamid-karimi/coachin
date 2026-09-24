import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCheckinProposal } from "@/app/lib/checkin-data";
import { CheckinView } from "../components/checkin-view";

export const metadata: Metadata = { title: "Weekly check-in · CoachIn" };

type SearchParams = Promise<{ plan?: string | string[] }>;

export default async function CheckinPage({ searchParams }: { searchParams: SearchParams }) {
  const { plan } = await searchParams;
  // No plan, or no check-in due for it: back to the programs.
  const proposal = typeof plan === "string" && plan ? await getCheckinProposal(plan) : null;
  if (!proposal) redirect("/training");
  return <CheckinView proposal={proposal} />;
}
