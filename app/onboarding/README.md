# Onboarding Module — "My week" commitments editor

`/onboarding` is where users manage their **recurring weekly commitments**. It doubles as
the first-run onboarding flow (`completeOnboarding` redirects to the dashboard) and stays
reachable afterwards ("Edit routine" from the calendar).

## Commitments model

Two commitment types (see `plans/weekly-commitments.md` and `FORMULAS.md` § Weekly quotas):

- **Fixed session (anchor)** — sport + fixed day + optional time + optional repeat-until.
  Stored in `schedules`. Anchors create "required days" for the daily streak
  (`evaluate_user_streak`): the streak expects them.
- **Weekly target (quota)** — sport × N sessions per week (1–14), no fixed day. Stored in
  `weekly_quotas` (one row per user × sport; re-adding a sport upserts its target).
  Fulfilled automatically by **completed** logs of that sport: progress = distinct days
  within the Mon–Sun local week (`quotaProgress` in `lib/weekly-quotas.ts`). Quotas are
  **informational only** — they do NOT create required days and never affect streaks,
  hearts, or XP.

AI plan sessions (from `/training`) appear read-only alongside both.

## Structure

- `page.tsx`: server page — fetches sports, schedules, plan items, quotas, and this
  week's logs; computes quota progress; orchestration only
- `loading.tsx`: route-level skeleton
- `actions.ts`: server actions — schedules (`addScheduleSessions`, `deleteScheduleItem`),
  quotas (`getWeeklyQuotas`, `addWeeklyQuota`, `deleteWeeklyQuota`), `completeOnboarding`
- `components/`
  - `AddCommitmentSection.tsx` — segmented control ("Fixed session" | "Weekly target")
    switching between the two add forms
  - `AddFixedSessionForm.tsx` — day strip + sport picker + optional time/repeat-until
  - `AddWeeklyTargetForm.tsx` — sport picker + sessions/week stepper (1–14)
  - `SportPicker.tsx` — shared sport chip row (real sport names, no XP multiplier)
  - `WeeklyTargetList.tsx` — one row per quota with "n/m this week" progress
    (volt badge once met) and delete; renders nothing when there are no quotas
  - `WeekAgenda.tsx` — one vertical day-by-day agenda (same on mobile + desktop)
  - `RoutineSessionCard.tsx` — editable, brand-tinted fixed-session card
  - `PlanSessionCard.tsx` — clickable read-only AI plan session
  - `PlanSessionSheet.tsx` — detail sheet (title, type, day) opened from a plan card
  - `PlanTypeIcon.tsx` — `item_type` → icon
  - `CompleteOnboardingButton.tsx`
  - layout helpers (`PageHeader`, `PageContainer`)
- `hooks/`
  - `useRedirect.ts` — client redirect after `completeOnboarding`

## Data Flow

1. The server page fetches all data and computes `quotaProgress(quotas, weekLogs)` for
   the current Mon–Sun week; components receive plain props.
2. Each interactive leaf owns its `useActionState` (add fixed session, add weekly
   target, delete quota, delete schedule item, complete) with toasts via
   `useActionToast`; actions `revalidatePath` so the server page re-renders with fresh
   data — no client-side refetching. Adding a fixed session dispatches
   `addScheduleSessions`, which fans the sport out across every selected day via the
   pure, unit-tested `lib/schedule-inserts.ts` helper and inserts all rows in one call.
3. `WeekAgenda` renders fixed sessions and any active AI plan items per day; tapping an
   AI plan card opens `PlanSessionSheet` (bottom sheet on mobile, dialog on desktop).
   The plan is read-only here — it is edited in `/training`.
4. Completion redirects to the dashboard.

Shared helpers: `lib/week-days.ts` (Monday-first day list), `lib/schedule-inserts.ts`
(multi-day fan-out, unit-tested), `lib/plan-items.ts` (`item_type` → human label),
`lib/weekly-quotas.ts` (quota progress math), `lib/dates.ts` (`mondayOf`, `toLocalYMD`).

## Sport types

Sports come from the admin-seeded `sport_types` table. The
`20260706140000_dedup_mobility_sport_types.sql` migration collapses the several
hand-entered "Mobility" duplicates into one canonical row (neutral 1.0
xp_multiplier) so the sport picker shows a single Mobility option.

## Notifications and Language

- User-facing messages are English-only.
- Transient success/error states use toast notifications instead of inline banners.

## Storybook

Initial coverage includes:

- `page-header.stories.tsx`
- `DaySportPicker.stories.tsx` — default and empty-sport-list states
