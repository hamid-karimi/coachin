import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { MealPlanScreen } from "../components/meal-plan-screen";

export const metadata: Metadata = { title: "Meal plan · CoachIn" };

export default async function MealPlanPage() {
  const state = await prefetchQueries((api, qc) => [qc.prefetchQuery(api.queryOptions("get", "/nutrition/plan"))]);
  return (
    <HydrationBoundary state={state}>
      <MealPlanScreen />
    </HydrationBoundary>
  );
}
