import { redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";
import { mondayOf, toLocalYMD } from "@/lib/dates";
import { quotaProgress } from "@/lib/weekly-quotas";
import {
  getSportTypes,
  getUserSchedules,
  getCurrentPlanWeekItems,
  getWeeklyQuotas,
} from "./actions";
import {
  PageHeader,
  PageContainer,
  AddCommitmentSection,
  WeeklyTargetList,
  WeekAgenda,
  CompleteOnboardingButton,
} from "./components";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  // Current local week window (Mon–Sun) for weekly-target progress.
  const monday = mondayOf(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const supabase = await createClient();
  const [sports, schedules, planItems, quotas, { data: weekLogs }] =
    await Promise.all([
      getSportTypes(),
      getUserSchedules(),
      getCurrentPlanWeekItems(),
      getWeeklyQuotas(),
      supabase
        .from("logs")
        .select("date, sport_type_id, status")
        .eq("user_id", user.id)
        .gte("date", toLocalYMD(monday))
        .lte("date", toLocalYMD(sunday)),
    ]);

  const progress = quotaProgress(quotas, weekLogs ?? []);
  const plannedDays = [...new Set(schedules.map((s) => s.day_of_week))];

  // Rough weekly XP estimate: 60 XP per session × the sport's multiplier.
  const multiplierBySportId = new Map(
    sports.map((sport) => [
      Number(sport.id),
      Number(sport.xp_multiplier ?? 1) || 1,
    ]),
  );
  const estimatedWeeklyXp = Math.round(
    schedules.reduce(
      (total, s) => total + 60 * (multiplierBySportId.get(s.sport_type_id) ?? 1),
      0,
    ),
  );

  return (
    <PageContainer>
      <PageHeader
        title='My week'
        description='Fixed sessions and weekly targets — your recurring commitments. AI plan sessions appear alongside.'
      />

      <AddCommitmentSection sports={sports} plannedDays={plannedDays} />

      <WeeklyTargetList quotas={quotas} progress={progress} />

      <WeekAgenda schedules={schedules} planItems={planItems} />

      <CompleteOnboardingButton
        plannedDayCount={plannedDays.length}
        estimatedWeeklyXp={estimatedWeeklyXp}
      />
    </PageContainer>
  );
}
