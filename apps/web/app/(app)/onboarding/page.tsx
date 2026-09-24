import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchQueries } from "@/app/lib/prefetch";
import { AddCommitmentSheet } from "./components/add-commitment-sheet";
import { CompleteOnboardingButton } from "./components/complete-onboarding-button";
import { PageHeader } from "./components/page-header";
import { WeekAgenda } from "./components/week-agenda";
import { WeeklyTargetList } from "./components/weekly-target-list";

export const metadata: Metadata = { title: "My week · CoachIn" };

export default async function OnboardingPage() {
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/routine")),
    qc.prefetchQuery(api.queryOptions("get", "/sport-types")),
  ]);
  return (
    <HydrationBoundary state={state}>
      <div className='mx-auto w-full max-w-4xl'>
        <PageHeader
          title='My week'
          description='Fixed sessions and weekly targets — your recurring commitments. AI plan sessions appear alongside.'
        />
        <AddCommitmentSheet />
        <WeeklyTargetList />
        <WeekAgenda />
        <CompleteOnboardingButton />
      </div>
    </HydrationBoundary>
  );
}
