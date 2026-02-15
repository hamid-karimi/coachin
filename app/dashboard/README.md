# Dashboard Module

The dashboard is the daily execution surface where users see today's plan and log completed workouts.

## Structure

- `page.tsx`: loads profile, today's schedule, and today's logs
- `actions.ts`: `logWorkout` server action for logging activity and updating XP
- `components/workout-card.tsx`: card UI for each planned activity
- `logout-button.tsx`: sign-out control

## Key Behavior

- Filters weekly schedule by today's weekday.
- Prevents duplicate completion by checking existing logs for today.
- Updates XP and level after successful workout logging.
- Uses confetti on successful completion.

## Notifications and Language

- User-facing messages are English-only.
- Transient success/error feedback is delivered via toast notifications.

## Storybook

Initial coverage includes:

- No dashboard stories are currently enabled because action-bound components require Storybook-safe mocks.
