# Onboarding Module

The onboarding flow helps users build their recurring weekly workout schedule.

## Structure

- `page.tsx`: main onboarding flow
- `actions.ts`: server actions for add/delete schedule items and completion
- `components/`
  - `AddScheduleForm.tsx`
  - `ScheduleGrid.tsx`
  - `CompleteOnboardingButton.tsx`
  - layout helpers (`PageHeader`, `PageContainer`, `LoadingScreen`)
- `hooks/`
  - `useLoadData.ts`
  - `useRefreshSchedules.ts`
  - `useRedirect.ts`

## Data Flow

1. User selects day, sport, and optional time.
2. Action inserts a schedule row in Supabase.
3. UI refreshes schedule state after mutation.
4. Completion redirects to dashboard.

## Notifications and Language

- User-facing messages are now English-only.
- Transient success/error states use toast notifications instead of inline banners.

## Storybook

Initial coverage includes:

- `page-header.stories.tsx`
