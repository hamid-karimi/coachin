# Dashboard Module

The Dashboard is the primary user interface where users view their daily schedule and log their workouts.

## Structure

- **components/**:
  - `workout-card.tsx`: Displays a single scheduled sport with a "Complete" action.
- `page.tsx`: Main dashboard view. Fetches `schedules`, `logs`, and `sport_types` to render the day's plan.
- `actions.ts`: Contains `logWorkout`, handling the logic for marking a workout as done and awarding XP.
- `logout-button.tsx`: Client component to handle user sign-out.

## Key Features

- **Daily Plan**: Automatically filters the user's weekly schedule to show only today's activities.
- **Gamification**:
  - Calculates XP based on sport duration multipliers.
  - Triggers a confetti animation upon successful logging.
- **Progress Tracking**: Prevents duplicate logging by checking existing logs for the current date.
