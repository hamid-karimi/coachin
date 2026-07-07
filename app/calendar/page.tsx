import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Repeat,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { mondayOf, planWeekForDate, toLocalYMD } from "@/lib/dates";
import { hasHardCollision } from "@/lib/training-day";
import { AppShell } from "@/components/design-system/app-shell";
import { Button } from "@/components/ui/button";
import { SportIcon } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import type { PlanItemDetails } from "@/lib/plan-items";
import { cn } from "@/lib/utils";
import { DayPlanItems } from "./components/day-plan-items";

export const dynamic = "force-dynamic";

type ScheduleRow = {
  day_of_week: number;
  time: string | null;
  starts_on: string | null;
  ends_on: string | null;
  sport_type_id: number | null;
  sport_types: { name: string | null } | null;
};

type PlanItemRow = {
  plan_id: string;
  week: number;
  day_of_week: number;
  item_type: string;
  title: string;
  is_completed: boolean;
  details: PlanItemDetails | null;
};

type ActivePlan = { id: string; created_at: string; weeks_total: number };

function within(date: string, start: string | null, end: string | null) {
  return (!start || date >= start) && (!end || date <= end);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { week: weekParam } = await searchParams;
  const anchor =
    weekParam && !Number.isNaN(new Date(`${weekParam}T00:00:00`).getTime())
      ? new Date(`${weekParam}T00:00:00`)
      : new Date();
  const monday = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
  const mondayYmd = toLocalYMD(days[0]);
  const sundayYmd = toLocalYMD(days[6]);
  const todayYmd = toLocalYMD(new Date());

  const supabase = await createClient();
  const [
    { data: profile },
    { data: schedules },
    { data: activePlans },
    { data: logs },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("schedules")
      .select(
        "day_of_week, time, starts_on, ends_on, sport_type_id, sport_types(name)",
      )
      .eq("user_id", user.id)
      .or(`starts_on.is.null,starts_on.lte.${sundayYmd}`)
      .or(`ends_on.is.null,ends_on.gte.${mondayYmd}`),
    supabase
      .from("training_plans")
      .select("id, created_at, weeks_total")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("plan_kind"),
    supabase
      .from("logs")
      .select("date, sport_type_id, status")
      .eq("user_id", user.id)
      .gte("date", mondayYmd)
      .lte("date", sundayYmd),
  ]);

  const coachNav = canCoach(profile?.role);
  const plans = (activePlans ?? []) as ActivePlan[];

  // Plan items across ALL active plans for the weeks this calendar week spans.
  // Each plan anchors its own plan-week from its own created_at, so a given
  // calendar date may map to a different week number per plan.
  const planIds = plans.map((p) => p.id);
  let planItems: PlanItemRow[] = [];
  if (planIds.length > 0) {
    const weekNums = Array.from(
      new Set(
        plans.flatMap((p) =>
          days
            .map((d) => planWeekForDate(p.created_at, d))
            .filter((w) => w >= 1 && w <= p.weeks_total),
        ),
      ),
    );
    if (weekNums.length > 0) {
      const { data: items } = await supabase
        .from("plan_items")
        .select(
          "plan_id, week, day_of_week, item_type, title, is_completed, details",
        )
        .in("plan_id", planIds)
        .in("week", weekNums);
      planItems = (items ?? []) as PlanItemRow[];
    }
  }

  // date ymd → merged plan items landing that day (across all active plans).
  const planByDate = new Map<string, PlanItemRow[]>();
  for (const plan of plans) {
    for (const date of days) {
      const ymd = toLocalYMD(date);
      const planWeek = planWeekForDate(plan.created_at, date);
      const dayItems = planItems.filter(
        (p) =>
          p.plan_id === plan.id &&
          p.week === planWeek &&
          p.day_of_week === date.getDay(),
      );
      if (dayItems.length === 0) continue;
      const list = planByDate.get(ymd) ?? [];
      list.push(...dayItems);
      planByDate.set(ymd, list);
    }
  }

  // date ymd → set of completed sport_type_ids
  const doneByDate = new Map<string, Set<number>>();
  for (const log of logs ?? []) {
    if (log.status !== "completed" || log.sport_type_id == null) continue;
    const set = doneByDate.get(log.date) ?? new Set<number>();
    set.add(log.sport_type_id);
    doneByDate.set(log.date, set);
  }
  const anyDoneByDate = new Map<string, boolean>();
  for (const log of logs ?? []) {
    if (log.status === "completed") anyDoneByDate.set(log.date, true);
  }

  const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const thisMonday = mondayOf(new Date());
  const isCurrentWeek = toLocalYMD(monday) === toLocalYMD(thisMonday);

  return (
    <AppShell coachNav={coachNav}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              Calendar
            </h1>
            <p className="text-muted-foreground text-sm">
              Your recurring routine, active plans, and logged workouts on real
              dates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding">
                <Pencil aria-hidden />
                Edit routine
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/training">
                <Sparkles aria-hidden />
                Manage programs
              </Link>
            </Button>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?week=${toLocalYMD(prevMonday)}`}
            className="border-border text-foreground hover:bg-secondary inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Prev
          </Link>
          <p className="text-foreground text-sm font-semibold">
            {weekLabel}
            {isCurrentWeek ? (
              <span className="text-brand-ink"> · this week</span>
            ) : null}
          </p>
          <Link
            href={`/calendar?week=${toLocalYMD(nextMonday)}`}
            className="border-border text-foreground hover:bg-secondary inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm"
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>

        {/* Days */}
        <div className="flex flex-col gap-3">
          {days.map((date) => {
            const ymd = toLocalYMD(date);
            const dow = date.getDay();
            const isToday = ymd === todayYmd;
            const doneSports = doneByDate.get(ymd) ?? new Set<number>();

            const routines = (
              (schedules ?? []) as unknown as ScheduleRow[]
            ).filter(
              (s) =>
                s.day_of_week === dow &&
                within(ymd, s.starts_on, s.ends_on),
            );
            const dayPlan = planByDate.get(ymd) ?? [];
            const collision = hasHardCollision(dayPlan);

            const empty = routines.length === 0 && dayPlan.length === 0;

            return (
              <div
                key={ymd}
                className={cn(
                  "border-border rounded-xl border p-3",
                  isToday && "border-brand/40 bg-brand-tint/30",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                    {isToday && (
                      <span className="bg-brand-tint text-brand-ink ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        Today
                      </span>
                    )}
                  </p>
                  {anyDoneByDate.get(ymd) && (
                    <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
                      <Check className="size-3.5" aria-hidden />
                      logged
                    </span>
                  )}
                </div>

                {empty ? (
                  <p className="text-muted-foreground text-xs">Rest</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {collision && (
                      <p className="bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-medium">
                        <TriangleAlert className="size-3" aria-hidden />2
                        intense workouts today — consider spacing them.
                      </p>
                    )}
                    {routines.map((s, i) => {
                      const done =
                        s.sport_type_id != null &&
                        doneSports.has(s.sport_type_id);
                      return (
                        <div
                          key={`r-${i}`}
                          className="flex items-center gap-2.5 text-sm"
                        >
                          <SportIcon
                            sport={sportFromName(s.sport_types?.name)}
                            className="size-7 shrink-0"
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              done && "text-muted-foreground line-through",
                            )}
                          >
                            {s.sport_types?.name ?? "Workout"}
                            {s.time ? ` · ${s.time.slice(0, 5)}` : ""}
                          </span>
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                            <Repeat className="size-3" aria-hidden />
                            routine
                          </span>
                        </div>
                      );
                    })}
                    <DayPlanItems items={dayPlan} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
