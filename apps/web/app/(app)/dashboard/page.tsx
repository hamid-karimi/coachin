import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { CalendarRange, UtensilsCrossed } from "lucide-react";
import { getMe } from "@/app/lib/me-data";
import { prefetchQueries } from "@/app/lib/prefetch";
import { canCoach } from "@/lib/roles";
import { CoachingCard } from "./components/coaching-card";
import { EntryCard } from "./components/entry-card";
import { GoalStrip } from "./components/goal-strip";
import { GroupNudge } from "./components/group-nudge";
import { PlanAndTargets } from "./components/plan-and-targets";
import { ProgressOverview } from "./components/progress-overview";
import { ProgressPhotoNudge } from "./components/progress-photo-nudge";
import { SupplementsCard } from "./components/supplements-card";
import { TodaysMealsCard } from "./components/todays-meals-card";
import { TodayHeader } from "./components/today-header";
import { TodaysPlan } from "./components/todays-plan";

export const metadata: Metadata = { title: "Today · CoachIn" };

export default async function DashboardPage() {
  const me = await getMe();
  const coach = canCoach(me?.role);
  const community = me?.features.community ?? false;
  const state = await prefetchQueries((api, qc) => [
    qc.prefetchQuery(api.queryOptions("get", "/today")),
    qc.prefetchQuery(api.queryOptions("get", "/goals")),
    ...(coach ? [qc.prefetchQuery(api.queryOptions("get", "/coaching/summary"))] : []),
    ...(community ? [qc.prefetchQuery(api.queryOptions("get", "/community/group-nudge"))] : []),
  ]);
  return (
    <HydrationBoundary state={state}>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-5'>
        <TodayHeader name={me?.fullName || me?.email || "athlete"} />
        {coach && <CoachingCard />}
        <ProgressOverview />
        <PlanAndTargets />
        <EntryCard
          href='/calendar'
          icon={CalendarRange}
          title='This week'
          subtitle='Routine, plan, and logged workouts on real dates'
        />
        <EntryCard
          href='/nutrition'
          icon={UtensilsCrossed}
          tone='flame'
          title='Nutrition'
          subtitle='Log meals by search or photo · +5 XP each (first 3 daily)'
        />
        <TodaysMealsCard />
        <ProgressPhotoNudge />
        {community && <GroupNudge />}
        <SupplementsCard />
        <GoalStrip />
        <TodaysPlan />
      </div>
    </HydrationBoundary>
  );
}
