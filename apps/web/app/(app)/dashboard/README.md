# Dashboard module — "Today"

The daily execution surface: see today's plan, log it, watch XP and the streak move.

## API (Go: `apps/api/internal/app/today`, `app/training`)

| Call | What |
| --- | --- |
| `GET /today` | Settles the streak for past days (`evaluate_user_streak`), then returns `stats` (XP, level progress, streak, hearts, tier), today's fixed `sessions` (with `completed`, `estimatedXp`), today's `planItems` blended across every active plan (each in its own week), `planWeek`, `hardCollision`, `doneCount`/`totalCount` (meal notes excluded), weekly-target `quotas`, `progressPhoto` nudge |
| `POST /today/workouts` | `{sportTypeId}` → `round(60 × multiplier)` XP; log, ledger row, and balance in one transaction; once per sport per day (409 otherwise) |
| `PUT /plan-items/{id}/completion` | `{completed}` → XP delta (`+60/+30/+20` by type, compensated on undo); done only on the item's day or the day after |

## Structure

- `page.tsx` — prefetches `/today` (+ `getMe` for the name) and hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-today.ts` — `useToday` (suspense query), `useLogWorkout` (refetches Today and
  My week)
- `lib/today.ts` — greeting, initials, date label, tier labels, level %, plurals, plan
  card subtitle, multiplier suffix (unit-tested)
- `components/`
  - `today-header.tsx` — date, greeting, streak badge, avatar
  - `progress-overview.tsx` — level ring + XP bar, hearts, desktop stat row
  - `plan-and-targets.tsx` — training-plan card (or the plan pitch) + weekly-target chips
  - `entry-card.tsx` — link card used for plan / calendar / nutrition
  - `progress-photo-nudge.tsx`
  - `todays-plan.tsx` — "x of y done", rest-day state, workout cards, plan items with
    the collision chip
  - `workout-card.tsx` — pending → "Log it" → reward state (XP, next streak, confetti);
    done state for sports logged earlier today

Shared: `app/(app)/components/plan-item-row.tsx` + `app/(app)/hooks/use-plan-item-completion.ts`
(optimistic done toggle, used by Training and Calendar later),
`components/hooks/use-confetti-burst.ts` (colors from theme tokens).

## Not yet ported (arrive with their modules)

Daily supplements (3.2b), today's meal-plan menu (Nutrition), featured goal strip
(Profile), coaching card (Coaching), group-streak nudge (Community), session "Log details"
(Training).

## Differences from legacy

- A second log of the same sport on the same day is refused by the API (legacy only hid
  the button); the XP ledger reason carries the date.
- The plan-item log window is enforced by the API too, not only by the disabled button.
- A sport with no multiplier earns 60 XP (legacy produced NaN).
