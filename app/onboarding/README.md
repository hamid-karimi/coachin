# Onboarding Module

The onboarding flow helps users build their recurring weekly workout schedule.

## Structure

- `page.tsx`: main onboarding flow
- `actions.ts`: server actions for add/delete schedule items and completion
- `components/`
  - `WeekAgenda.tsx` — one vertical day-by-day agenda (same on mobile + desktop);
    each day row carries a "+ Add session" control that opens the inline picker
  - `DaySportPicker.tsx` — inline day-first session composer (sport grid,
    "also on" multi-day toggles, "More options" for time + repeat-until, Add)
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
  - `useAddSession.ts` — local state (selected sport, day set, more-options) for
    the inline picker

## Data Flow

The week is composed **in place** — there is no standalone add form. Each day
row in `WeekAgenda` has a "+ Add session" affordance:

1. Tapping "+ Add session" opens `DaySportPicker` inline beneath that day, with
   the tapped day pre-selected.
2. User picks one sport (icon + name only — no XP multiplier at planning time),
   optionally toggles other days via the "also on" row, and can expand
   "More options" for an optional time and repeat-until date.
3. Add dispatches `addScheduleSessions`, which fans the sport out across every
   selected day via the pure `lib/schedule-inserts.ts` helper and inserts all
   rows in one call.
4. UI refreshes schedule state after mutation.
5. `WeekAgenda` renders the manual routine and any active AI plan items per
   day; tapping an AI plan card opens `PlanSessionSheet` (a bottom sheet on
   mobile, a centered dialog on desktop). The plan is read-only here — it is
   edited in `/training`.
6. Completion redirects to dashboard.

Shared helpers: `lib/week-days.ts` (Monday-first day list, used by the picker and
the agenda), `lib/schedule-inserts.ts` (multi-day fan-out, unit-tested), and
`lib/plan-items.ts` (`item_type` → human label).

## Sport types

Sports come from the admin-seeded `sport_types` table. The
`20260706140000_dedup_mobility_sport_types.sql` migration collapses the several
hand-entered "Mobility" duplicates into one canonical row (neutral 1.0
xp_multiplier) so the picker grid shows a single Mobility option.

## Notifications and Language

- User-facing messages are now English-only.
- Transient success/error states use toast notifications instead of inline banners.

## Storybook

Initial coverage includes:

- `page-header.stories.tsx`
- `DaySportPicker.stories.tsx` — default and empty-sport-list states
