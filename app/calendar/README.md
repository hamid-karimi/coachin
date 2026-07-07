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
- When 2+ hard sessions (`run`/`strength`) land on the same day across plans, a
  soft chip ("2 intense workouts today — consider spacing them") appears on that cell,
  via `hasHardCollision` (`lib/training-day.ts`). No load coordination beyond
  the nudge.

## Notifications and Language

- User-facing text is English-only.
