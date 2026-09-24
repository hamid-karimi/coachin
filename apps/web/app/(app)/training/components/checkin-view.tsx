import { Activity, AlertTriangle, ClipboardCheck, Route, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/design-system/stat-card";
import type { CheckinProposal } from "@/app/lib/checkin-data";
import { cn } from "@/lib/utils";
import { checkinFlags, DECISION_COPY } from "../lib/checkin";
import { ConfirmCheckinButton } from "./confirm-checkin-button";

/** The weekly check-in: scorecard, flags, the decision, and the proposed next week. */
export function CheckinView({ proposal }: { proposal: CheckinProposal }) {
  const { scorecard, reviewWeek, targetWeek } = proposal;
  const decision = DECISION_COPY[proposal.decision];
  const flags = checkinFlags(scorecard);

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5'>
      <div>
        <h1 className='text-foreground font-display flex items-center gap-2 text-2xl font-bold tracking-tight'>
          <ClipboardCheck className='text-brand-ink size-6' aria-hidden />
          Week {reviewWeek} check-in
        </h1>
        <p className='text-muted-foreground text-sm'>How the week went, and what happens to week {targetWeek}.</p>
      </div>

      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <StatCard
          label='Adherence'
          value={`${scorecard.adherencePct}%`}
          icon={<TrendingUp className='size-5' aria-hidden />}
          accent={scorecard.adherencePct < 50 ? "flame" : "brand"}
        />
        <StatCard
          label='Sessions'
          value={`${scorecard.completedItems}/${scorecard.plannedItems}`}
          icon={<Activity className='size-5' aria-hidden />}
        />
        <StatCard label='Planned km' value={scorecard.plannedKm} icon={<Route className='size-5' aria-hidden />} />
        <StatCard
          label='Actual km'
          value={scorecard.actualKm}
          icon={<Route className='size-5' aria-hidden />}
          accent='brand'
        />
      </div>

      {flags.length > 0 && (
        <div className='bg-card border-border flex flex-col gap-2 rounded-xl border p-4'>
          <h2 className='text-overline'>Flagged sessions</h2>
          {flags.map((flag, index) => (
            <p
              key={index}
              className={cn("flex items-start gap-2 text-sm", flag.red ? "text-destructive" : "text-muted-foreground")}>
              <AlertTriangle className='mt-0.5 size-4 shrink-0' aria-hidden />
              {flag.text}
            </p>
          ))}
        </div>
      )}

      <div className='bg-card border-border flex flex-col gap-2 rounded-xl border p-4'>
        <h2 className='text-overline'>Decision</h2>
        <p className='text-foreground text-lg font-semibold'>{decision.label}</p>
        <p className='text-muted-foreground text-sm'>{decision.blurb}</p>
        <ul className='text-muted-foreground list-disc pl-5 text-sm'>
          {proposal.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className='bg-brand-tint border-brand-ink/20 flex flex-col gap-1 rounded-xl border p-4'>
        <h2 className='text-overline'>Proposed week {targetWeek}</h2>
        <p className='text-foreground text-sm'>{proposal.summary}</p>
        <p className='text-muted-foreground text-xs'>
          {proposal.items.length} items · only week {targetWeek} changes — the rest of the plan stays untouched.
        </p>
      </div>

      <ConfirmCheckinButton proposal={proposal} />
    </div>
  );
}
