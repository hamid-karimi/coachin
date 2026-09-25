import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { ClubsView } from "../components/clubs-view";

export const metadata: Metadata = { title: "Clubs · CoachIn" };

export default async function ClubsPage() {
  const state = await prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/community/clubs"))]);
  return (
    <HydrationBoundary state={state}>
      <ClubsView />
    </HydrationBoundary>
  );
}
