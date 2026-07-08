import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, CalendarPlus, Pencil, Plus } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { daysUntil, lastElapsedPlanWeek, planWeekOf } from "@/lib/dates";
import { planTitleFor } from "@/lib/plan-title";
import { AppShell } from "@/components/design-system/app-shell";
import { Button } from "@/components/ui/button";
import { ProgramCard, type ProgramCardData } from "./components/program-card";

export const dynamic = "force-dynamic";

type ActivePlan = {
  id: string;
  race_date: string | null;
  goal_time: string | null;
  weeks_total: number;
  created_at: string;
  plan_kind: string;
  intake: {
    plan_kind?: string;
    race_target?: string;
    race_distance_km?: number;
  } | null;
  created_by: string | null;
};

export default async function TrainingPage() {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("training_plans")
      .select(
        "id, race_date, goal_time, weeks_total, created_at, plan_kind, intake, created_by",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("plan_kind"),
  ]);

  const coachNav = canCoach(profile?.role);
  const activePlans = (plans ?? []) as ActivePlan[];

  if (activePlans.length === 0) {
    return (
      <AppShell coachNav={coachNav}>
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16 text-center">
          <span className="bg-brand-tint text-brand-ink grid size-14 place-items-center rounded-2xl">
            <CalendarHeart className="size-7" aria-hidden />
          </span>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight">
            My programs
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Create a training plan — running or building muscle — and get an
            AI-generated week-by-week program with sessions, strength, mobility,
            recovery, and fueling notes. You can run one program per discipline
            at once.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link href="/training/new">
              <Plus aria-hidden />
              Create a plan
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  // Weekly check-in is due when a plan week fully elapsed, a next week exists to
  // adjust, and no weekly_checkins row reviews it yet.
  const reviewWeekOf = new Map<string, number>();
  const checkinCandidates: string[] = [];
  for (const plan of activePlans) {
    const reviewWeek = lastElapsedPlanWeek(plan.created_at, plan.weeks_total);
    reviewWeekOf.set(plan.id, reviewWeek);
    if (reviewWeek >= 1 && reviewWeek < plan.weeks_total) {
      checkinCandidates.push(plan.id);
    }
  }
  const reviewedKeys = new Set<string>();
  if (checkinCandidates.length > 0) {
    const { data: checkins } = await supabase
      .from("weekly_checkins")
      .select("plan_id, week")
      .in("plan_id", checkinCandidates);
    for (const row of checkins ?? []) {
      reviewedKeys.add(`${row.plan_id}:${row.week}`);
    }
  }

  const cards: ProgramCardData[] = activePlans.map((plan) => {
    const currentWeek = Math.min(
      Math.max(planWeekOf(plan.created_at, plan.weeks_total), 1),
      plan.weeks_total,
    );
    const reviewWeek = reviewWeekOf.get(plan.id) ?? 0;
    const checkinDue =
      reviewWeek >= 1 &&
      reviewWeek < plan.weeks_total &&
      !reviewedKeys.has(`${plan.id}:${reviewWeek}`);
    return {
      id: plan.id,
      title: planTitleFor(plan.plan_kind, plan.intake),
      weeks_total: plan.weeks_total,
      currentWeek,
      daysUntilRace: plan.race_date ? daysUntil(plan.race_date) : null,
      goal_time: plan.goal_time,
      isHypertrophy: plan.plan_kind === "hypertrophy",
      // created_by is null on pre-migration rows; only a differing creator
      // marks a coach-generated plan.
      fromCoach: Boolean(plan.created_by && plan.created_by !== user.id),
      reviewWeek,
      checkinDue,
    };
  });

  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              My programs
            </h1>
            <p className="text-muted-foreground text-sm">
              Your active training plans — one per discipline. Your day-by-day
              schedule lives in Calendar; here you create, archive, and review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="brand" size="sm">
              <Link href="/training/new">
                <Plus aria-hidden />
                New plan
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding">
                <Pencil aria-hidden />
                Edit routine
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/training/calendar.ics" download>
                <CalendarPlus aria-hidden />
                Add to calendar
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {cards.map((card) => (
            <ProgramCard key={card.id} plan={card} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
