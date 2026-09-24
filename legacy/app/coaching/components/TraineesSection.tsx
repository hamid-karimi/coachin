import Link from "next/link";
import { Salad, WandSparkles } from "lucide-react";

import type { StudentRelationship } from "@/app/community/types";
import type {
  TraineeAdherence,
  PlanAdherence,
} from "../lib/coaching-hub-data";
import { AdherenceWeekStrip } from "./AdherenceWeekStrip";
import { AssignPlanButton } from "@/app/community/components/AssignPlanButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TraineesSectionProps {
  students: StudentRelationship[];
  /** userId → XP earned this week, from the get_weekly_leaderboard RPC. */
  weeklyXpByUserId?: Map<string, number>;
  /** userId → this week's schedule adherence (logs + schedules). */
  adherenceByUserId?: Map<string, TraineeAdherence>;
  /** userId → per-active-plan current-week adherence (one entry per plan). */
  planAdherenceByUserId?: Map<string, PlanAdherence[]>;
  /** Monday of the current week, YYYY-MM-DD (local time). */
  weekStart?: string;
  /** userId → the trainee shares nutrition with their coach. */
  nutritionSharedByUserId?: Map<string, boolean>;
}

export function TraineesSection({
  students,
  weeklyXpByUserId,
  adherenceByUserId,
  planAdherenceByUserId,
  weekStart,
  nutritionSharedByUserId,
}: TraineesSectionProps) {
  const hasStudents = students.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-[15px] font-bold'>
          My trainees{hasStudents ? ` · ${students.length}` : ""}
        </CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        {hasStudents ? (
          <ul className='space-y-2'>
            {students.map((relationship) => {
              const { student } = relationship;
              const initials = student.email?.[0]?.toUpperCase() ?? "?";
              const weeklyXp = weeklyXpByUserId?.get(student.id);
              const adherence = adherenceByUserId?.get(student.id);
              const offTrackPlans = (
                planAdherenceByUserId?.get(student.id) ?? []
              ).filter((plan) => plan.adherencePct < 50);

              return (
                <li
                  key={student.id}
                  className='bg-secondary flex items-center justify-between gap-3 rounded-lg p-3'>
                  <div className='flex min-w-0 items-center gap-3'>
                    <Avatar className='size-10'>
                      {student.avatar_url ? (
                        <AvatarImage
                          src={student.avatar_url}
                          alt={student.full_name ?? student.email ?? "Trainee"}
                        />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-semibold text-foreground'>
                        {student.full_name ||
                          student.email ||
                          "Unknown trainee"}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {relationship.sport_type?.name || "General coaching"} ·
                        Level {student.level ?? 1}
                        {typeof weeklyXp === "number"
                          ? ` · ${weeklyXp.toLocaleString()} XP this week`
                          : ""}
                      </p>
                      {adherence && weekStart ? (
                        <div className='mt-1.5 flex items-center gap-2.5'>
                          <AdherenceWeekStrip
                            scheduledDays={adherence.scheduledDays}
                            loggedDates={adherence.loggedDates}
                            weekStart={weekStart}
                          />
                          <span className='text-xs text-muted-foreground'>
                            {adherence.scheduledCount === 0
                              ? "No plan assigned yet"
                              : `${adherence.doneCount} of ${adherence.scheduledCount} this week`}
                          </span>
                          {offTrackPlans.map((plan) => (
                            <Badge key={plan.planId} variant='flame'>
                              Off-track ·{" "}
                              {plan.kind === "hypertrophy"
                                ? "Strength"
                                : "Running"}{" "}
                              {Math.round(plan.adherencePct)}%
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    <Badge variant='xp'>
                      {student.xp?.toLocaleString() ?? 0} XP
                    </Badge>
                    <AssignPlanButton studentId={student.id} />
                    <Button asChild size='sm' variant='secondary'>
                      <Link href={`/training/new?student=${student.id}`}>
                        <WandSparkles aria-hidden />
                        Generate plan
                      </Link>
                    </Button>
                    {nutritionSharedByUserId?.get(student.id) && (
                      <Button asChild size='sm' variant='ghost'>
                        <Link
                          href={`/coaching/trainees/${student.id}/nutrition`}>
                          <Salad aria-hidden />
                          Nutrition
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>
            No trainees yet — share an invite code to connect.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
