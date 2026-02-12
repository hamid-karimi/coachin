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

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <PageContainer>
      <PageHeader
        title='برنامه‌ریزی هفتگی 📅'
        description='مشخص کن هر روز چه ورزشی داری. این برنامه الگوی تکرارشونده توئه.'
      />

      <AddScheduleForm
        sports={sports}
        onSubmit={addAction}
        error={addState.error}
        success={addState.success}
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
        error={completeState.error}
      />
    </PageContainer>
  );
}
