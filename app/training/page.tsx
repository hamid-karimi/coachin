import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, CalendarPlus, Pencil, Plus, Sparkles } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { daysUntil, lastElapsedPlanWeek, planWeekOf } from "@/lib/dates";
import { planTitleFor } from "@/lib/plan-title";
import { AppShell } from "@/components/design-system/app-shell";
import { Button } from "@/components/ui/button";
import { type PlanItem } from "./components/plan-item-row";
import {
  PlanSection,
  weekParamFor,
  type PlanSectionData,
} from "./components/plan-section";

export const dynamic = "force-dynamic";

type ActivePlan = {
  id: string;
  race_date: string | null;
  goal_time: string | null;
  weeks_total: number;
  summary: string | null;
  created_at: string;
  plan_kind: string;
  intake: {
    plan_kind?: string;
    race_target?: string;
    race_distance_km?: number;
  } | null;
};

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
        "id, race_date, goal_time, weeks_total, summary, created_at, plan_kind, intake",
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
            Add a goal — running or building muscle — and get an AI-generated
            week-by-week program with sessions, strength, mobility, recovery,
            and fueling notes. You can run one program per discipline at once.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link href="/training/new">
              <Sparkles aria-hidden />
              Add a goal
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const params = await searchParams;
  const weekOf = (planId: string): number | undefined => {
    const raw = params[weekParamFor(planId)];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? Number(value) : undefined;
  };

  // Resolve the shown week per plan, then fetch all plans' items for their
  // shown week in one round-trip (guarded against an empty id list).
  const shownWeek = new Map<string, number>();
  for (const plan of activePlans) {
    const currentWeek = planWeekOf(plan.created_at, plan.weeks_total);
    const week = Math.min(
      Math.max(weekOf(plan.id) ?? currentWeek, 1),
      plan.weeks_total,
    );
    shownWeek.set(plan.id, week);
  }

  const planIds = activePlans.map((plan) => plan.id);
  const { data: items } = await supabase
    .from("plan_items")
    .select("id, plan_id, week, day_of_week, item_type, title, details, is_completed")
    .in("plan_id", planIds)
    .order("day_of_week");

  const itemsByPlan = new Map<string, PlanItem[]>();
  for (const item of (items ?? []) as (PlanItem & {
    plan_id: string;
    week: number;
  })[]) {
    if (item.week !== shownWeek.get(item.plan_id)) continue;
    const list = itemsByPlan.get(item.plan_id) ?? [];
    list.push(item);
    itemsByPlan.set(item.plan_id, list);
  }

  // Weekly check-in banner: due when a plan week fully elapsed, a next week
  // exists to adjust, and no weekly_checkins row reviews it yet.
  const reviewWeekOf = new Map<string, number>();
  const checkinCandidates: { plan_id: string; week: number }[] = [];
  for (const plan of activePlans) {
    const reviewWeek = lastElapsedPlanWeek(plan.created_at, plan.weeks_total);
    reviewWeekOf.set(plan.id, reviewWeek);
    if (reviewWeek >= 1 && reviewWeek < plan.weeks_total) {
      checkinCandidates.push({ plan_id: plan.id, week: reviewWeek });
    }
  }
  const reviewedKeys = new Set<string>();
  if (checkinCandidates.length > 0) {
    const { data: checkins } = await supabase
      .from("weekly_checkins")
      .select("plan_id, week")
      .in(
        "plan_id",
        checkinCandidates.map((c) => c.plan_id),
      );
    for (const row of checkins ?? []) {
      reviewedKeys.add(`${row.plan_id}:${row.week}`);
    }
  }

  const sections: PlanSectionData[] = activePlans.map((plan) => {
    const currentWeek = planWeekOf(plan.created_at, plan.weeks_total);
    const reviewWeek = reviewWeekOf.get(plan.id) ?? 0;
    const checkinDue =
      reviewWeek >= 1 &&
      reviewWeek < plan.weeks_total &&
      !reviewedKeys.has(`${plan.id}:${reviewWeek}`);
    return {
      id: plan.id,
      created_at: plan.created_at,
      weeks_total: plan.weeks_total,
      summary: plan.summary,
      goal_time: plan.goal_time,
      race_date: plan.race_date,
      title: planTitleFor(plan.plan_kind, plan.intake),
      isHypertrophy: plan.plan_kind === "hypertrophy",
      daysUntilRace: plan.race_date ? daysUntil(plan.race_date) : null,
      currentWeek,
      week: shownWeek.get(plan.id) ?? currentWeek,
      reviewWeek,
      checkinDue,
      items: itemsByPlan.get(plan.id) ?? [],
    };
  });

  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              My programs
            </h1>
            <p className="text-muted-foreground text-sm">
              Your active training programs — one per discipline. Add a goal,
              archive a program, or edit your recurring routine.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="brand" size="sm">
              <Link href="/training/new">
                <Plus aria-hidden />
                Add a goal
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
        {sections.map((section) => (
          <PlanSection key={section.id} plan={section} />
        ))}
      </div>
    </AppShell>
  );
}
