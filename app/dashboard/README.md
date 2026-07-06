# Dashboard Module

The dashboard is the daily execution surface where users see today's plan and log completed workouts.

## Structure

- `page.tsx`: loads profile, today's schedule, and today's logs
- `actions.ts`: `logWorkout` server action for logging activity and updating XP
- `components/workout-card.tsx`: card UI for each planned activity
- `logout-button.tsx`: sign-out control

## Key Behavior

- Filters weekly schedule by today's weekday.
- Surfaces today's AI training-plan items (from the active `training_plans` plan, date-anchored week) under "Today's plan" via the shared `PlanItemRow`, counted together with routine items in the day's done/total tally (meal notes excluded).
- Plan-item completion goes through the `complete_plan_item` RPC: it awards type-based XP (run/strength 60, stretch/mobility 30, recovery 20) and writes a `logs` row linked via `logs.plan_item_id`, so plan sessions feed the streak, calendar "logged" badge, and group nudges. Undo removes the log and compensates the XP, so toggling can't farm XP.
- Prevents duplicate completion by checking existing logs for today.
- Updates XP and level after successful workout logging.
- Uses confetti on successful completion.

## Notifications and Language

- User-facing messages are English-only.
- Transient success/error feedback is delivered via toast notifications.

## Storybook

Initial coverage includes:

- No dashboard stories are currently enabled because action-bound components require Storybook-safe mocks.
