import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getMe } from "@/app/lib/me-data";
import { prefetchQueries } from "@/app/lib/prefetch";
import { canTrain } from "@/lib/roles";
import { CircleView } from "../components/circle-view";

export const metadata: Metadata = { title: "Circle · CoachIn" };

export default async function CirclePage() {
  const [me, state] = await Promise.all([
    getMe(),
    prefetchQueries((api, qc) => [
      qc.prefetchQuery(api.queryOptions("get", "/community/circle")),
      qc.prefetchQuery(api.queryOptions("get", "/community/people", { params: { query: { q: "", page: 1 } } })),
    ]),
  ]);
  return (
    <HydrationBoundary state={state}>
      <CircleView canTrain={canTrain(me?.role)} />
    </HydrationBoundary>
  );
}
