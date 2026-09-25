# Calendar module

A week at a glance: the recurring routine, every active AI plan, and logged workouts on
real dates. A daily-use surface and the gateway to programs ("Manage programs").

## API (Go: `apps/api/internal/app/calendar`)

| Call | What |
| --- | --- |
| `GET /calendar?week=YYYY-MM-DD` | The Monday–Sunday week containing `week` (this week when missing or invalid): `weekStart`/`weekEnd`, `prevWeek`/`nextWeek` (Mondays), `today`, `isCurrentWeek`, `quotas` (weekly targets scored on the **viewed** week's completed logs), and seven `days` — `routines` (fixed sessions whose `starts_on`/`ends_on` window covers the date; `done` when that sport has a completed log that day), `planItems` (blended across every active plan, each in its own week from its own start), `logged` (any completed log), `hardCollision` (2+ run/strength items), `meals` with an active meal plan (`plannedCount`, `plannedKcal`, and `adherence` — slots logged / planned, kcal ratio — for today and past days only; FORMULAS §13) |

## Structure

- `page.tsx` — prefetches `/calendar` for `?week=` (options from `lib/calendar.ts`
  `calendarQuery`, so server and client keys match) and hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-calendar.ts` — reads `?week=` (nuqs) and the hydrated query
- `lib/calendar.ts` — week/day/routine labels, rest-day check (unit-tested)
- `components/`
  - `calendar-view.tsx` — header (Edit routine, Manage programs), `week-nav.tsx`,
    `weekly-targets.tsx` (`QuotaChip`), the day cards
  - `day-card.tsx` — "Today" badge, "logged", collision chip, rows, or "Rest", then
    `day-meals-line.tsx` ("3 meals planned · 1,800 kcal" → `/nutrition/plan`, plus the
    muted adherence line; text from `nutrition/lib/meal-plan.ts`)
  - `routine-session-item.tsx` — row + sheet ("Every week at 07:00", edit link, "Log it on
    Today" only on today's card)
  - `day-plan-items.tsx` — rows opening the shared read-only
    `app/(app)/components/plan-session-sheet.tsx`

Plan-item toggles and session logs refetch every calendar week
(`PLAN_PROGRESS_KEYS`); a confirmed check-in does too.

