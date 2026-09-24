import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { NutritionView } from "./components/nutrition-view";

export const metadata: Metadata = { title: "Nutrition · CoachIn" };

export default async function NutritionPage() {
  const state = await prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/nutrition/day"))]);
  return (
    <HydrationBoundary state={state}>
      <NutritionView />
    </HydrationBoundary>
  );
}
