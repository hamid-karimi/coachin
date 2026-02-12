# Onboarding Module

This module guides new users through setting up their initial weekly workout schedule.

## Structure

- **components/**:
  - `ScheduleGrid.tsx`: Visual representation of the week's schedule.
  - `AddScheduleForm.tsx`: UI for selecting a sport, day, and time.
  - `PageHeader.tsx`, `PageContainer.tsx`: Layout components.
- **hooks/**: Custom hooks for managing onboarding state.
  - `useLoadData.ts`: Fetches initial `sport_types` and existing plan.
  - `useRefreshSchedules.ts`: Refreshes the view after updates.
- `actions.ts`: Server actions to `upsertSchedule` or `deleteSchedule`.

## Data Flow

1. User selects a sport, day, and time.
2. `upsertSchedule` updates the `schedules` table in Supabase.
3. UI optimistically updates or re-fetches to show the new card in the grid.
4. "Complete Setup" redirects to the Dashboard.
