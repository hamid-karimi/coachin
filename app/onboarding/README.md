# Onboarding Module

The onboarding flow helps users build their recurring weekly workout schedule.

## Structure

- `page.tsx`: main onboarding flow
- `actions.ts`: server actions for add/delete schedule items and completion
- `components/`
  - `AddScheduleForm.tsx`
  - `WeekAgenda.tsx` — one vertical day-by-day agenda (same on mobile + desktop)
  - `RoutineSessionCard.tsx` — editable, brand-tinted manual routine session
  - `PlanSessionCard.tsx` — clickable read-only AI plan session
  - `PlanSessionSheet.tsx` — detail sheet (title, type, day) opened from a plan card
  - `PlanTypeIcon.tsx` — `item_type` → icon
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
4. `WeekAgenda` renders the manual routine and any active AI plan items per
   day; tapping an AI plan card opens `PlanSessionSheet` (a bottom sheet on
   mobile, a centered dialog on desktop). The plan is read-only here — it is
   edited in `/training`.
5. Completion redirects to dashboard.

Shared helpers: `lib/week-days.ts` (Monday-first day list, used by the form and
the agenda) and `lib/plan-items.ts` (`item_type` → human label).

## Notifications and Language

- User-facing messages are now English-only.
- Transient success/error states use toast notifications instead of inline banners.

## Storybook

Initial coverage includes:

- `page-header.stories.tsx`
