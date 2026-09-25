import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { getMe } from "@/app/lib/me-data";
import { prefetchQueries } from "@/app/lib/prefetch";
import { canCoach } from "@/lib/roles";
import { CoachingView } from "./components/coaching-view";

export const metadata: Metadata = { title: "Coaching · CoachIn" };

export default async function CoachingPage() {
  const me = await getMe();
  if (!canCoach(me?.role)) redirect("/dashboard");
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/coaching")),
    qc.prefetchQuery(api.queryOptions("get", "/sport-types")),
  ]);
  return (
    <HydrationBoundary state={state}>
      <CoachingView />
    </HydrationBoundary>
  );
}
