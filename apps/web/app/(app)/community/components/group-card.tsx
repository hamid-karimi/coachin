import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupCodeLine, groupStreakLine, type TrainingGroup } from "../lib/community";
import { PersonRow } from "./person-row";

/** A group: streak, last 7 settled days, members (most XP this week first). */
export function GroupCard({ group, onLeave }: { group: TrainingGroup; onLeave: () => void }) {
  return (
    <div className='bg-secondary space-y-3 rounded-lg p-3'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-foreground text-sm font-semibold'>{group.name}</p>
          <p className='text-muted-foreground text-xs'>{groupCodeLine(group)}</p>
        </div>
        <span className='text-flame-ink inline-flex items-center gap-1 text-sm font-bold'>
          <Flame className='size-4' aria-hidden />
          {groupStreakLine(group)}
        </span>
      </div>
      {group.recentDays.length > 0 && (
        <div className='flex gap-1.5'>
          {group.recentDays.map((day) => (
            <span
              key={day.date}
              title={`${day.date}: ${day.allTrained ? "everyone trained" : "streak frozen"}`}
              aria-label={`${day.date}: ${day.allTrained ? "everyone trained" : "streak frozen"}`}
              className={cn("size-2 rounded-full", day.allTrained ? "bg-success" : "bg-border")}
            />
          ))}
        </div>
      )}
      <ul className='space-y-1.5'>
        {group.members.map((m) => (
          <PersonRow
            key={m.userId}
            name={m.isYou ? `${m.name} (you)` : m.name}
            avatarUrl={m.avatarUrl}
            subtitle={`${m.weeklyXp.toLocaleString("en-US")} XP this week · ${m.trainedToday ? "Trained today" : "Not yet today"}`}
          />
        ))}
      </ul>
      <Button type='button' size='sm' variant='destructive-outline' onClick={onLeave}>
        Leave group
      </Button>
    </div>
  );
}
