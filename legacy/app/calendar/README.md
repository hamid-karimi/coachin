# Calendar Module

A week-at-a-glance view placing the user's recurring routine, AI training
plans, and logged workouts on real calendar dates.

## Structure

- `page.tsx`: loads the profile, the recurring `schedules` for the visible week,
  **all** active `training_plans` + their `plan_items`, and the week's `logs`.
  Orchestration only; day cells are rendered inline. Week is chosen via the
  `?week=<YYYY-MM-DD>` anchor.
- `loading.tsx`: static skeleton (server component; `animate-pulse` +
  `bg-secondary` blocks) shown while the page's server data resolves, matching
  the `max-w-3xl` container, header, week-nav, and seven day cells.

## Time-first IA

Calendar is a daily-use surface and the **gateway to programs**. Its header
links to "Edit routine" (`/onboarding`) and "Manage programs" (`/training`) —
the latter is always shown, since `/training` (the "My programs" manager) is no
longer a standalone nav tab.

## Key Behavior

- Renders 7 day cells (Monday-first) for the anchored week, each listing that
  day's recurring routine items and AI plan items.
- **Blends all active plans**: a user can hold one running + one hypertrophy
  plan concurrently. Plan items are merged per date across every active plan;
  each plan anchors its own plan-week from its own `created_at`, so one calendar
  date can map to a different week number per plan.
- Marks a day "logged" when any `logs` row for that date is `completed`, and
  strikes through routine items whose sport type was logged that day.
- Routine rows are clickable (`RoutineSessionItem`, a client leaf): they open a
  bottom sheet (same pattern as plan items) with the recurrence details, a link
  to the routine editor, and — on the session's own day — a "Log it on Today"
  button deep-linking to `/dashboard`, where routines are actually logged
  (`WorkoutCard`). Other days show a hint instead of a dead button.
- Plan items show their short `title` in the cell; the full session detail
  (`plan_items.description`) renders inside the item's detail sheet.
- When an active AI meal plan exists, each day cell ends with a quiet
  "N meals planned · X kcal" link to `/nutrition/plan` (menu data via
  `app/nutrition/lib/meal-plan-day.ts`, keyed by weekday — the menu repeats
  weekly). Shown on rest days too; hidden when there is no active plan.
- With an active meal plan, **today's and past** day cells also show a muted
  adherence line under that link (e.g. "2/3 meals logged · 85% of plan kcal",
  or "No meals logged"), computed by `mealAdherenceForDay`
  (`lib/meal-adherence.ts`) from the week's `meal_logs` (one extra SELECT,
  only when a plan exists) — slots match on `meal_type`, kcal is a ratio vs
  the plan. Future days keep the plain planned link. Rendered via
  `components/day-meals-line.tsx`. Display-only — no XP/streaks/hearts
  (`FORMULAS.md` §13, Meal adherence).
- When the user has weekly targets (`weekly_quotas`), a "Weekly targets" chip
  row (shared `QuotaChip` from `components/design-system/`) sits under the week
  navigation, computed by `quotaProgress` (`lib/weekly-quotas.ts`) from the
  **viewed** week's completed logs — the same week-scoped `logs` query the day
  cells use — so past and future weeks score correctly. Informational only
  (`FORMULAS.md` §11); hidden when no quotas exist.
- When 2+ hard sessions (`run`/`strength`) land on the same day across plans, a
  soft chip ("2 intense workouts today — consider spacing them") appears on that cell,
  via `hasHardCollision` (`lib/training-day.ts`). No load coordination beyond
  the nudge.

## Notifications and Language

- User-facing text is English-only.
