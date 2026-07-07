import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  TriangleAlert,
} from "lucide-react";

import { planItemDate, toLocalYMD } from "@/lib/dates";
import { hasHardCollision } from "@/lib/training-day";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlanItemRow, type PlanItem } from "./plan-item-row";
import { ArchivePlanButton } from "./archive-plan-button";

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

export type PlanSectionData = {
  id: string;
  created_at: string;
  weeks_total: number;
  summary: string | null;
  goal_time: string | null;
  race_date: string | null;
  title: string;
  isHypertrophy: boolean;
  daysUntilRace: number | null;
  currentWeek: number;
  week: number;
  reviewWeek: number;
  checkinDue: boolean;
  items: PlanItem[];
};

/** The `?week` query param scoped to a single plan so each plan navigates
 * independently when multiple are active. */
export function weekParamFor(planId: string): string {
  return `w_${planId}`;
}

function weekHref(planId: string, week: number): string {
  return `/training?${weekParamFor(planId)}=${week}`;
}

/**
 * A single active plan. `secondary` marks any plan after the first when
 * multiple stack on the page: the header and week-nav get a lighter, more
 * compact treatment so the repeated chrome recedes, while every control
 * (independent week nav, archive, check-in banner) stays fully functional.
 */
export function PlanSection({
  plan,
  secondary = false,
}: {
  plan: PlanSectionData;
  secondary?: boolean;
}) {
  const byDay = new Map<number, PlanItem[]>();
  for (const item of plan.items) {
    const list = byDay.get(item.day_of_week) ?? [];
    list.push(item);
    byDay.set(item.day_of_week, list);
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-5",
        secondary && "border-border border-t pt-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={cn(
              "text-foreground font-display font-bold tracking-tight",
              secondary ? "text-lg" : "text-xl md:text-2xl",
            )}
          >
            {plan.title}
          </h2>
          <p className="text-muted-foreground text-sm">
            {plan.daysUntilRace !== null
              ? `Race in ${plan.daysUntilRace} days · `
              : ""}
            {plan.goal_time ? `goal ${plan.goal_time} · ` : ""}
            {plan.weeks_total} weeks
            {plan.isHypertrophy ? " · progressive overload" : ""}
          </p>
        </div>
        <ArchivePlanButton planId={plan.id} />
      </div>

      {plan.checkinDue && (
        <div className="bg-brand-tint border-brand-ink/20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="text-brand-ink text-sm font-semibold">
              Week {plan.reviewWeek} review ready — see your scorecard
            </p>
            <p className="text-muted-foreground text-xs">
              Review how the week went and confirm the adjustment for week{" "}
              {plan.reviewWeek + 1}.
            </p>
          </div>
          <Button asChild variant="brand" size="sm">
            <Link href={`/training/checkin?plan=${plan.id}`}>
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

      {/* Week navigation — lighter (ghost) buttons on stacked secondary plans
          so the repeated control recedes; nav stays fully independent. */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant={secondary ? "ghost" : "outline"}
          size="sm"
          className={plan.week <= 1 ? "pointer-events-none opacity-40" : ""}
        >
          <Link href={weekHref(plan.id, plan.week - 1)}>
            <ChevronLeft aria-hidden />
            Week {plan.week - 1}
          </Link>
        </Button>
        <div className="text-center">
          <p className="text-foreground text-sm font-semibold">
            Week {plan.week} of {plan.weeks_total}
            {plan.week === plan.currentWeek ? (
              <span className="text-brand-ink"> · current</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs">
            {planItemDate(plan.created_at, plan.week, 1).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )}{" "}
            –{" "}
            {planItemDate(plan.created_at, plan.week, 0).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )}
          </p>
        </div>
        <Button
          asChild
          variant={secondary ? "ghost" : "outline"}
          size="sm"
          className={
            plan.week >= plan.weeks_total
              ? "pointer-events-none opacity-40"
              : ""
          }
        >
          <Link href={weekHref(plan.id, plan.week + 1)}>
            Week {plan.week + 1}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      {/* Days */}
      <div className="flex flex-col gap-4">
        {DAYS.map((day) => {
          const dayItems = byDay.get(day.id) ?? [];
          if (dayItems.length === 0) return null;
          const dayDate = planItemDate(plan.created_at, plan.week, day.id);
          const dayYmd = toLocalYMD(dayDate);
          const isToday = dayYmd === toLocalYMD(new Date());
          const collision = hasHardCollision(dayItems);
          return (
            <div key={day.id} className="space-y-2">
              <h3 className="text-overline flex items-center gap-2">
                <span>{day.name}</span>
                <span className="text-muted-foreground/70 normal-case">
                  {dayDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {isToday && (
                  <span className="bg-brand-tint text-brand-ink rounded-full px-2 py-0.5 text-[10px] font-bold normal-case">
                    Today
                  </span>
                )}
              </h3>
              {collision && (
                <p className="bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                  <TriangleAlert className="size-3.5" aria-hidden />2 intense
                  workouts today — consider spacing them.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {dayItems.map((item) => (
                  <PlanItemRow key={item.id} item={item} date={dayYmd} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
