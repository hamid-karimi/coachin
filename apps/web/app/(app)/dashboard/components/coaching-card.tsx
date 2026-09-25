"use client";

import { GraduationCap } from "lucide-react";
import { $api } from "@/lib/api/browser";
import { coachingSummaryLine } from "@/app/(app)/coaching/lib/coaching";
import { EntryCard } from "./entry-card";

/** Coach-capable roles with at least one trainee: a way into the hub. */
export function CoachingCard() {
  const { traineeCount, trainedThisWeek } = $api.useSuspenseQuery("get", "/coaching/summary").data;
  if (traineeCount === 0) return null;
  return (
    <EntryCard
      href='/coaching'
      icon={GraduationCap}
      title='Coaching'
      subtitle={coachingSummaryLine(traineeCount, trainedThisWeek)}
    />
  );
}
