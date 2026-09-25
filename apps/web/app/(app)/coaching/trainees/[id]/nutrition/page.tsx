import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { getMe } from "@/app/lib/me-data";
import { prefetchQueries } from "@/app/lib/prefetch";
import { canCoach } from "@/lib/roles";
import { TraineeNutritionView } from "../../../components/trainee-nutrition-view";

export const metadata: Metadata = { title: "Trainee nutrition · CoachIn" };

export default async function TraineeNutritionPage({ params }: { params: Promise<{ id: string }> }) {
  const [me, { id }] = await Promise.all([getMe(), params]);
  if (!canCoach(me?.role)) redirect("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/coaching/trainees/{id}/nutrition", { params: { path: { id } } })),
  ]);
  return (
    <HydrationBoundary state={state}>
      <TraineeNutritionView traineeId={id} />
    </HydrationBoundary>
  );
}
