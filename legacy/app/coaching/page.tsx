import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/design-system/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canCoach } from "@/lib/roles";
import { LeaderboardSection } from "@/app/community/components/LeaderboardSection";
import { GenerateInviteCodeForm } from "./components/GenerateInviteCodeForm";
import { TraineesSection } from "./components/TraineesSection";
import { getCoachingHubData } from "./lib/coaching-hub-data";

export const dynamic = "force-dynamic";

export default async function CoachingHubPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!canCoach(profile?.role)) {
    redirect("/dashboard");
  }

  const {
    students,
    sportTypes,
    inviteCodes,
    weeklyLeaderboard,
    weeklyXpByUserId,
    adherenceByUserId,
    planAdherenceByUserId,
    nutritionSharedByUserId,
    weekStart,
  } = await getCoachingHubData(supabase, user.id);

  const traineeCount = students.length;

  return (
    <AppShell coachNav>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        {/* Header */}
        <header>
          <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
            Coaching
          </h1>
          <p className='text-muted-foreground text-sm'>
            {traineeCount === 0
              ? "No trainees yet — share an invite code to connect."
              : `${traineeCount} active ${traineeCount === 1 ? "trainee" : "trainees"}`}
          </p>
        </header>

        {/* Trainee roster, with per-trainee "Trained this week" adherence.
            The logs data relies on the coach-read RLS policy migration
            (20260704120000); before it's applied the strip simply shows
            zero completed sessions. */}
        <TraineesSection
          students={students}
          weeklyXpByUserId={weeklyXpByUserId}
          adherenceByUserId={adherenceByUserId}
          planAdherenceByUserId={planAdherenceByUserId}
          weekStart={weekStart}
          nutritionSharedByUserId={nutritionSharedByUserId}
        />

        {/* Invite codes */}
        <Card>
          <CardHeader>
            <CardTitle className='text-[15px] font-bold'>
              Invite codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GenerateInviteCodeForm
              sportTypes={sportTypes}
              inviteCodes={inviteCodes}
            />
          </CardContent>
        </Card>

        {/* Trainee weekly leaderboard */}
        <LeaderboardSection
          leaderboard={weeklyLeaderboard}
          currentUserId={user.id}
          title='Trainee leaderboard'
          whatCounts='your trainees, ranked by XP earned this week'
          emptyMessage='No trainees yet — share an invite code to connect.'
        />
      </div>
    </AppShell>
  );
}
