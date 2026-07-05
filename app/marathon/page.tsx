import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { daysUntil, lastElapsedPlanWeek, planWeekOf } from "@/lib/dates";
import { AppShell } from "@/components/design-system/app-shell";
import { Button } from "@/components/ui/button";
import { PlanItemRow, type PlanItem } from "./components/plan-item-row";
import { ArchivePlanButton } from "./components/archive-plan-button";

export const dynamic = "force-dynamic";

// Monday-first display order carrying real day_of_week ids (0=Sun..6=Sat),
// same convention as the coaching adherence strip.
const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 0, name: "Sunday" },
];

export default async function MarathonPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("training_plans")
      .select("id, race_date, goal_time, weeks_total, summary, created_at, intake")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const coachNav = canCoach(profile?.role);

  if (!plan) {
    return (
      <AppShell coachNav={coachNav}>
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16 text-center">
          <span className="bg-brand-tint text-brand-ink grid size-14 place-items-center rounded-2xl">
            <CalendarHeart className="size-7" aria-hidden />
          </span>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight">
            Train for your race
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            First 5k or full marathon — answer a few questions about your
            running and get an AI-generated week-by-week program — runs with paces, strength, mobility,
            recovery, and fueling notes.
          </p>
          <Button asChild variant="brand" size="lg">
            <Link href="/marathon/new">
              <Sparkles aria-hidden />
              Build my plan
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const currentWeek = planWeekOf(plan.created_at, plan.weeks_total);
  const { week: weekParam } = await searchParams;
  const week = Math.min(
    Math.max(Number(weekParam) || currentWeek, 1),
    plan.weeks_total,
  );

  // Weekly check-in banner: due when a plan week fully elapsed, a next week
  // exists to adjust, and no weekly_checkins row reviews it yet.
  const reviewWeek = lastElapsedPlanWeek(plan.created_at, plan.weeks_total);
  let checkinDue = false;
  if (reviewWeek >= 1 && reviewWeek < plan.weeks_total) {
    const { data: existingCheckin } = await supabase
      .from("weekly_checkins")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("week", reviewWeek)
      .maybeSingle();
    checkinDue = !existingCheckin;
  }

  const { data: items } = await supabase
    .from("plan_items")
    .select("id, week, day_of_week, item_type, title, details, is_completed")
    .eq("plan_id", plan.id)
    .eq("week", week)
    .order("day_of_week");

  const byDay = new Map<number, PlanItem[]>();
  for (const item of (items ?? []) as PlanItem[]) {
    const list = byDay.get(item.day_of_week) ?? [];
    list.push(item);
    byDay.set(item.day_of_week, list);
  }

  const daysUntilRace = daysUntil(plan.race_date);
  const intake = (plan.intake ?? {}) as {
    race_target?: string;
    race_distance_km?: number;
  };
  const planTitle =
    {
      "5k": "5k plan",
      "10k": "10k plan",
      half: "Half marathon plan",
      full: "Marathon plan",
      ultra: `Ultra plan${intake.race_distance_km ? ` (${intake.race_distance_km}km)` : ""}`,
      other: `${intake.race_distance_km ?? "?"}km race plan`,
    }[intake.race_target ?? "full"] ?? "Marathon plan";

  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              {planTitle}
            </h1>
            <p className="text-muted-foreground text-sm">
              Race in {daysUntilRace} days
              {plan.goal_time ? ` · goal ${plan.goal_time}` : ""} ·{" "}
              {plan.weeks_total} weeks
            </p>
          </div>
          <ArchivePlanButton planId={plan.id} />
        </div>

        {checkinDue && (
          <div className="bg-brand-tint border-brand-ink/20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="text-brand-ink text-sm font-semibold">
                Week {reviewWeek} review ready — see your scorecard
              </p>
              <p className="text-muted-foreground text-xs">
                Review how the week went and confirm the adjustment for week{" "}
                {reviewWeek + 1}.
              </p>
            </div>
            <Button asChild variant="brand" size="sm">
              <Link href="/marathon/checkin">
                <ClipboardCheck aria-hidden />
                Start check-in
              </Link>
            </Button>
          </div>
        )}

        {plan.summary && (
          <p className="bg-card border-border text-muted-foreground rounded-xl border p-4 text-sm">
            {plan.summary}
          </p>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={week <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={`/marathon?week=${week - 1}`}>
              <ChevronLeft aria-hidden />
              Week {week - 1}
            </Link>
          </Button>
          <p className="text-foreground text-sm font-semibold">
            Week {week} of {plan.weeks_total}
            {week === currentWeek ? (
              <span className="text-brand-ink"> · current</span>
            ) : null}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={
              week >= plan.weeks_total ? "pointer-events-none opacity-40" : ""
            }
          >
            <Link href={`/marathon?week=${week + 1}`}>
              Week {week + 1}
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>

        {/* Days */}
        <div className="flex flex-col gap-4">
          {DAYS.map((day) => {
            const dayItems = byDay.get(day.id) ?? [];
            if (dayItems.length === 0) return null;
            return (
              <section key={day.id} className="space-y-2">
                <h2 className="text-overline">{day.name}</h2>
                <div className="flex flex-col gap-2">
                  {dayItems.map((item) => (
                    <PlanItemRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
