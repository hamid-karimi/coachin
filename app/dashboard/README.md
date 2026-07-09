# Dashboard Module

The dashboard is the daily execution surface where users see today's plan and log completed workouts.

## Structure

- `page.tsx`: loads profile, today's schedule, today's logs, the active meal
  plan's menu, and the supplements stack
- `loading.tsx`: static skeleton (server component; `animate-pulse` + `bg-secondary` blocks) shown while the page's server data resolves, matching the `max-w-4xl` container and header/card rhythm
- `actions.ts`: `logWorkout` server action for logging activity and updating XP
- `supplements-actions.ts`: add / delete / toggle-taken for the daily stack
- `components/workout-card.tsx`: card UI for each planned activity
- `components/todays-meals-card.tsx`: today's menu from the active AI meal
  plan (server component; data via `app/nutrition/lib/meal-plan-day.ts`),
  linking to `/nutrition/plan`; hidden when no active meal plan exists
- `components/supplements-card.tsx`: "Daily stack" — supplements checklist
  (check off taken-today per item) with a manage sheet (add name + dose,
  delete). One `supplement_logs` row per supplement per day; **no XP,
  streaks, or hearts** (`FORMULAS.md` §13)
- `logout-button.tsx`: sign-out control

## Key Behavior

- Filters weekly schedule by today's weekday.
- When the user has weekly targets (`weekly_quotas`), a quiet "This week" chip
  row (shared `QuotaChip` from `components/design-system/`) shows per-sport
  progress near the training block — e.g. `Running 1/2 · Strength 0/2` —
  computed by `quotaProgress` (`lib/weekly-quotas.ts`) from the current Mon–Sun
  week's completed logs (fetched alongside the page's other data in one
  `Promise.all`). Informational only — no streak/hearts/XP effect
  (`FORMULAS.md` §11); hidden when no quotas exist.
- Surfaces today's AI training-plan items under "Today's plan" via the shared `PlanItemRow`, counted together with routine items in the day's done/total tally (meal notes excluded). Items are **blended across all active `training_plans`** (a user can hold one running + one hypertrophy plan concurrently); each plan resolves its own date-anchored week from its own `created_at`. When 2+ hard sessions (`run`/`strength`) land on today across plans, a soft chip ("2 intense workouts today — consider spacing them") appears via `hasHardCollision` (`lib/training-day.ts`).
- Plan-item completion goes through the `complete_plan_item` RPC: it awards type-based XP (run/strength 60, stretch/mobility 30, recovery 20) and writes a `logs` row linked via `logs.plan_item_id`, so plan sessions feed the streak, calendar "logged" badge, and group nudges. Undo removes the log and compensates the XP, so toggling can't farm XP.
- Prevents duplicate completion by checking existing logs for today.
- Updates XP and level after successful workout logging.
- Uses confetti on successful completion.
- On load, settles the personal streak/hearts up to yesterday via
  `settleUserStreak` → `evaluate_user_streak` RPC (rules in `FORMULAS.md` §2).
  The profile page settles the same way. League tier is derived from XP by a DB
  trigger (`FORMULAS.md` §3), so `profiles.league_tier` is always current.

## Notifications and Language

- User-facing messages are English-only.
- Transient success/error feedback is delivered via toast notifications.

## Storybook

Initial coverage includes:

- No dashboard stories are currently enabled because action-bound components require Storybook-safe mocks.
