import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Route,
  TrendingUp,
} from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { lastElapsedPlanWeek } from "@/lib/dates";
import {
  computeWeekScorecard,
  decideWeek,
  type ScorecardSessionLog,
  type WeekScorecard,
} from "@/lib/scorecard";
import { generateWeekAdjustment } from "@/lib/ai/week-adjustment";
import type { PlanItemInput } from "@/lib/ai/marathon";
import { AppShell } from "@/components/design-system/app-shell";
import { StatCard } from "@/components/design-system/stat-card";
import { ConfirmCheckinForm } from "./confirm-checkin-form";

export const dynamic = "force-dynamic";

const DECISION_COPY: Record<string, { label: string; blurb: string }> = {
  advance: {
    label: "Advance",
    blurb: "Next week progresses as planned, lightly tuned to how this week went.",
  },
  repeat: {
    label: "Repeat the week",
    blurb: "Next week mirrors this week's structure so you can nail it before moving on.",
  },
  deload: {
    label: "Deload",
    blurb: "Next week's volume comes down so you can recover and rebuild momentum.",
  },
};

type ItemRow = {
  id: string;
  week: number;
  day_of_week: number;
  item_type: string;
  title: string;
  details: Record<string, unknown> | null;
  is_completed: boolean;
};

export default async function CheckinPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("training_plans")
      .select("id, weeks_total, summary, created_at, intake")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (!plan) redirect("/marathon");

  // The reviewed week is the last fully-elapsed one; a next week must exist.
  const reviewWeek = lastElapsedPlanWeek(plan.created_at, plan.weeks_total);
  if (reviewWeek < 1 || reviewWeek >= plan.weeks_total) redirect("/marathon");
  const targetWeek = reviewWeek + 1;

  const [{ data: existingCheckin }, { data: reviewItems }, { data: nextItems }] =
    await Promise.all([
      supabase
        .from("weekly_checkins")
        .select("id")
        .eq("plan_id", plan.id)
        .eq("week", reviewWeek)
        .maybeSingle(),
      supabase
        .from("plan_items")
        .select("id, week, day_of_week, item_type, title, details, is_completed")
        .eq("plan_id", plan.id)
        .eq("week", reviewWeek)
        .order("day_of_week"),
      supabase
        .from("plan_items")
        .select("id, week, day_of_week, item_type, title, details, is_completed")
        .eq("plan_id", plan.id)
        .eq("week", targetWeek)
        .order("day_of_week"),
    ]);
  if (existingCheckin) redirect("/marathon");

  const items = (reviewItems ?? []) as ItemRow[];
  const upcoming = (nextItems ?? []) as ItemRow[];
  if (upcoming.length === 0) redirect("/marathon");

  // Session logs for the reviewed week's items, index-aligned with `items`.
  const { data: logRows } =
    items.length > 0
      ? await supabase
          .from("session_logs")
          .select("plan_item_id, actual, ai_feedback, note")
          .in(
            "plan_item_id",
            items.map((item) => item.id),
          )
      : { data: [] };
  const logByItemId = new Map<string, ScorecardSessionLog>(
    ((logRows ?? []) as (ScorecardSessionLog & { plan_item_id: string })[]).map(
      (row) => [row.plan_item_id, row],
    ),
  );

  const scorecard = computeWeekScorecard(
    items,
    items.map((item) => logByItemId.get(item.id) ?? null),
  );

  // Previous week's scorecard (for the two-low-weeks rule) from its check-in.
  let previous: WeekScorecard | null = null;
  if (reviewWeek > 1) {
    const { data: previousCheckin } = await supabase
      .from("weekly_checkins")
      .select("scorecard")
      .eq("plan_id", plan.id)
      .eq("week", reviewWeek - 1)
      .maybeSingle();
    if (previousCheckin?.scorecard) {
      previous = previousCheckin.scorecard as WeekScorecard;
    }
  }

  const { decision, reasons } = decideWeek(scorecard, previous);

  const nextWeekInputs: PlanItemInput[] = upcoming.map((item) => ({
    week: item.week,
    day_of_week: item.day_of_week,
    item_type: item.item_type as PlanItemInput["item_type"],
    title: item.title,
    details: (item.details ?? {}) as PlanItemInput["details"],
  }));

  const intake = (plan.intake ?? {}) as {
    race_target?: string;
    race_distance_km?: number;
    experience_level?: string;
    days_per_week?: number;
  };
  const intakeSummary = [
    intake.race_distance_km ? `${intake.race_distance_km}km race plan` : null,
    intake.experience_level ? `${intake.experience_level} runner` : null,
    intake.days_per_week ? `${intake.days_per_week} days/week` : null,
    plan.summary,
  ]
    .filter(Boolean)
    .join(" · ");

  // AI proposes the rewrite within the deterministic decision; on failure the
  // next week is kept unchanged and the summary falls back to the reasons.
  const adjustment = await generateWeekAdjustment({
    scorecard,
    decision,
    reasons,
    nextWeekItems: nextWeekInputs,
    targetWeek,
    intakeSummary,
  });
  const proposedItems =
    "error" in adjustment ? nextWeekInputs : adjustment.items;
  const proposedSummary =
    "error" in adjustment
      ? `Keeping week ${targetWeek} as planned. ${reasons.join(" ")}`
      : adjustment.summary;

  const decisionCopy = DECISION_COPY[decision];
  const flags = [
    ...scorecard.red_flags.map((text) => ({ text, red: true })),
    ...scorecard.caution_flags.map((text) => ({ text, red: false })),
  ];

  return (
    <AppShell coachNav={canCoach(profile?.role)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="text-brand-ink size-6" aria-hidden />
            Week {reviewWeek} check-in
          </h1>
          <p className="text-muted-foreground text-sm">
            How the week went, and what happens to week {targetWeek}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Adherence"
            value={`${scorecard.adherence_pct}%`}
            icon={<TrendingUp className="size-5" aria-hidden />}
            accent={scorecard.adherence_pct < 50 ? "flame" : "brand"}
          />
          <StatCard
            label="Sessions"
            value={`${scorecard.completed_items}/${scorecard.planned_items}`}
            icon={<Activity className="size-5" aria-hidden />}
          />
          <StatCard
            label="Planned km"
            value={scorecard.planned_km}
            icon={<Route className="size-5" aria-hidden />}
          />
          <StatCard
            label="Actual km"
            value={scorecard.actual_km}
            icon={<Route className="size-5" aria-hidden />}
            accent="brand"
          />
        </div>

        {flags.length > 0 && (
          <div className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="text-overline">Flagged sessions</h2>
            {flags.map((flag, index) => (
              <p
                key={index}
                className={`flex items-start gap-2 text-sm ${flag.red ? "text-destructive" : "text-muted-foreground"}`}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {flag.text}
              </p>
            ))}
          </div>
        )}

        <div className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-overline">Decision</h2>
          <p className="text-foreground text-lg font-semibold">
            {decisionCopy.label}
          </p>
          <p className="text-muted-foreground text-sm">{decisionCopy.blurb}</p>
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="bg-brand-tint border-brand-ink/20 flex flex-col gap-1 rounded-xl border p-4">
          <h2 className="text-overline">Proposed week {targetWeek}</h2>
          <p className="text-foreground text-sm">{proposedSummary}</p>
          <p className="text-muted-foreground text-xs">
            {proposedItems.length} items · only week {targetWeek} changes — the
            rest of the plan stays untouched.
          </p>
        </div>

        <ConfirmCheckinForm
          planId={plan.id}
          checkinWeek={reviewWeek}
          targetWeek={targetWeek}
          decision={decision}
          summary={proposedSummary}
          scorecardJson={JSON.stringify(scorecard)}
          itemsJson={JSON.stringify(proposedItems)}
        />
      </div>
    </AppShell>
  );
}
