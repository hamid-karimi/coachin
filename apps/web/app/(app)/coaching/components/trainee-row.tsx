import Link from "next/link";
import { Salad, WandSparkles } from "lucide-react";
import { AdherenceWeekStrip } from "@/components/design-system/adherence-week-strip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/app/(app)/dashboard/lib/today";
import { adherenceLine, offTrackChips, traineeSubtitle, type Trainee } from "../lib/coaching";
import { AssignPlanButton } from "./assign-plan-button";

/** A roster line: who, this week's dots, off-track plans, and the coach's actions. */
export function TraineeRow({ trainee }: { trainee: Trainee }) {
  return (
    <li className='bg-secondary flex flex-wrap items-center justify-between gap-3 rounded-lg p-3'>
      <div className='flex min-w-0 items-center gap-3'>
        <Avatar className='size-10'>
          {trainee.avatarUrl ? <AvatarImage src={trainee.avatarUrl} alt={trainee.name} /> : null}
          <AvatarFallback>{initials(trainee.name)}</AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <p className='text-foreground truncate text-sm font-semibold'>{trainee.name}</p>
          <p className='text-muted-foreground text-xs'>{traineeSubtitle(trainee)}</p>
          <div className='mt-1.5 flex flex-wrap items-center gap-2.5'>
            <AdherenceWeekStrip days={trainee.week} />
            <span className='text-muted-foreground text-xs'>{adherenceLine(trainee)}</span>
            {offTrackChips(trainee).map((chip) => (
              <Badge key={chip.id} variant='flame'>
                {chip.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-end'>
        <Badge variant='xp'>{trainee.xp.toLocaleString("en-US")} XP</Badge>
        <AssignPlanButton traineeId={trainee.id} name={trainee.name} />
        <Button asChild size='sm' variant='secondary'>
          <Link href={`/training/new?student=${trainee.id}`}>
            <WandSparkles aria-hidden />
            Generate plan
          </Link>
        </Button>
        {trainee.nutritionShared && (
          <Button asChild size='sm' variant='ghost'>
            <Link href={`/coaching/trainees/${trainee.id}/nutrition`}>
              <Salad aria-hidden />
              Nutrition
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
