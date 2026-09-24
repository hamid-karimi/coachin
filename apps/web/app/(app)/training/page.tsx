import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { ProgramsView } from "./components/programs-view";

export const metadata: Metadata = { title: "Training · CoachIn" };

export default async function TrainingPage() {
  const state = await prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/training/programs"))]);
  return (
    <HydrationBoundary state={state}>
      <ProgramsView />
    </HydrationBoundary>
  );
}
