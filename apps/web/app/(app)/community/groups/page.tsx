import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { GroupsView } from "../components/groups-view";

export const metadata: Metadata = { title: "Groups · CoachIn" };

export default async function GroupsPage() {
  const state = await prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/community/groups"))]);
  return (
    <HydrationBoundary state={state}>
      <GroupsView />
    </HydrationBoundary>
  );
}
