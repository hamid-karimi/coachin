import Link from "next/link";
import { CalendarRange, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArchivePlanButton } from "./archive-plan-button";

export type ProgramCardData = {
  id: string;
  title: string;
  weeks_total: number;
  /** Clamped to 1..weeks_total by the page. */
  currentWeek: number;
  daysUntilRace: number | null;
  goal_time: string | null;
  isHypertrophy: boolean;
  reviewWeek: number;
  checkinDue: boolean;
};

/**
 * A compact summary of one active program. The manager shows every active
 * program at a glance (add / archive / handle a check-in); the day-by-day
 * schedule lives in Calendar, so there is no week-by-week browsing here.
 */
export function ProgramCard({ plan }: { plan: ProgramCardData }) {
  const meta = [
    plan.daysUntilRace !== null ? `Race in ${plan.daysUntilRace} days` : null,
    `Week ${plan.currentWeek} of ${plan.weeks_total}`,
    plan.goal_time ? `goal ${plan.goal_time}` : null,
    plan.isHypertrophy ? "progressive overload" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="bg-card border-border flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-foreground font-display text-lg font-bold tracking-tight">
            {plan.title}
          </h2>
          <p className="text-muted-foreground text-sm">{meta}</p>
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

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/calendar">
          <CalendarRange aria-hidden />
          View sessions in Calendar
        </Link>
      </Button>
    </section>
  );
}
