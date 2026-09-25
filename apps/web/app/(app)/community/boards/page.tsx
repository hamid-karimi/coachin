import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { LeaderboardView } from "../components/leaderboard-view";
import { resolveBoard } from "../lib/community";

export const metadata: Metadata = { title: "Boards · CoachIn" };

type SearchParams = Promise<{ board?: string | string[] }>;

export default async function BoardsPage({ searchParams }: { searchParams: SearchParams }) {
  const board = resolveBoard((await searchParams).board);
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/community/leaderboard", { params: { query: { board } } })),
  ]);
  return (
    <HydrationBoundary state={state}>
      <LeaderboardView board={board} />
    </HydrationBoundary>
  );
}
