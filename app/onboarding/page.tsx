"use client";

import { useActionState } from "react";
import {
  addScheduleItem,
  deleteScheduleItem,
  completeOnboarding,
} from "./actions";
import {
  LoadingScreen,
  PageHeader,
  AddScheduleForm,
  ScheduleGrid,
  CompleteOnboardingButton,
  PageContainer,
} from "./components";
import { useLoadData, useRedirect, useRefreshSchedules } from "./hooks";
import { useActionToast } from "@/components/hooks/use-action-toast";

export default function OnboardingPage() {
  // Load initial data
  const { sports, schedules: initialSchedules, isLoading } = useLoadData();

  // Form states
  const [addState, addAction] = useActionState(addScheduleItem, {});
  const [deleteState, deleteAction] = useActionState(deleteScheduleItem, {});
  const [completeState, completeAction] = useActionState(
    completeOnboarding,
    {},
  );

  // Handle redirect on complete
  useRedirect({ redirectUrl: completeState.redirect });
  useActionToast(addState);
  useActionToast(deleteState);
  useActionToast(completeState);

  // Refresh schedules after add/delete
  const refreshedSchedulesFromAdd = useRefreshSchedules(
    addState.success ?? false,
  );
  const refreshedSchedulesFromDelete = useRefreshSchedules(
    deleteState.success ?? false,
  );

  // Use the most recent schedules data
  const schedules =
    refreshedSchedulesFromAdd.length > 0
      ? refreshedSchedulesFromAdd
      : refreshedSchedulesFromDelete.length > 0
        ? refreshedSchedulesFromDelete
        : initialSchedules;

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

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <PageContainer>
      <PageHeader
        title='Plan your week'
        description='Pick a day, pick a sport, add it. Aim for 3+ days.'
      />

      <AddScheduleForm
        sports={sports}
        onSubmit={addAction}
        plannedDays={plannedDays}
      />

      <ScheduleGrid
        schedules={schedules}
        deleteAction={deleteAction}
        onDeleteClick={(scheduleId, action) => {
          const formData = new FormData();
          formData.append("scheduleId", scheduleId);
          action(formData);
        }}
      />

      <CompleteOnboardingButton
        onSubmit={completeAction}
        plannedDayCount={plannedDays.length}
        estimatedWeeklyXp={estimatedWeeklyXp}
      />
    </PageContainer>
  );
}
