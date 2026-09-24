import Link from "next/link";
import { CalendarRange, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { programMeta, programTitle, type Program } from "../lib/programs";
import { ArchivePlanButton } from "./archive-plan-button";

/**
 * Compact summary of one active program: title, meta, the check-in CTA when
 * a week is ready for review, archive, and a link to its sessions.
 */
export function ProgramCard({ program }: { program: Program }) {
  return (
    <section className='bg-card border-border flex flex-col gap-4 rounded-2xl border p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-foreground font-display text-lg font-bold tracking-tight'>{programTitle(program)}</h2>
          <p className='text-muted-foreground text-sm'>
            {programMeta(program)}
            {program.fromCoach && <span className='text-brand-ink font-medium'> · By your coach</span>}
          </p>
        </div>
        <ArchivePlanButton planId={program.id} />
      </div>

      {program.checkinDue && (
        <div className='bg-brand-tint border-brand-ink/20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4'>
          <div>
            <p className='text-brand-ink text-sm font-semibold'>
              Week {program.reviewWeek} review ready — see your scorecard
            </p>
            <p className='text-muted-foreground text-xs'>
              Review how the week went and confirm the adjustment for week {program.reviewWeek + 1}.
            </p>
          </div>
          <Button asChild variant='brand' size='sm'>
            <Link href={`/training/checkin?plan=${program.id}`}>
              <ClipboardCheck aria-hidden />
              Start check-in
            </Link>
          </Button>
        </div>
      )}

      <Button asChild variant='ghost' size='sm' className='self-start'>
        <Link href='/calendar'>
          <CalendarRange aria-hidden />
          View sessions in Calendar
        </Link>
      </Button>
    </section>
  );
}
