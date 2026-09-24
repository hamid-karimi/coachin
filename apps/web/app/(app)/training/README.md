# Training module — "My programs"

`/training` is the program manager: every active plan (one per discipline) as a compact
card; the day-by-day schedule lives in Calendar, logging happens on Today.

## API (Go: `apps/api/internal/app/training`)

| Call | What |
| --- | --- |
| `GET /training/programs` | Active plans (ordered by plan kind: hypertrophy, then race) with `currentWeek`, `daysUntilRace`, `fromCoach` (creator ≠ owner), `reviewWeek` (last fully elapsed week), `checkinDue` (a next week exists and no check-in yet) |
| `POST /training/plans/{id}/archive` | Archive (progress kept); a no-op for other users' or already archived plans |
| `GET /training/calendar.ics` | All active plans' sessions as all-day events (meal notes excluded); 404 without an active plan |
| `PUT /plan-items/{id}/completion` | Done/undo (see the dashboard README) |

## Structure

- `page.tsx` — prefetches `/training/programs`, hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-programs.ts` — `usePrograms`, `useArchivePlan` (refetches programs, Today,
  My week)
- `lib/programs.ts` — card title (`lib/plan-title.ts`) and meta line (unit-tested)
- `components/`
  - `programs-view.tsx` — header actions (New plan, Edit routine, Add to calendar) + cards,
    or the "Create a plan" empty state
  - `program-card.tsx` — title, meta, "By your coach", check-in banner, calendar link
  - `archive-plan-button.tsx` — confirm dialog → archive
- `new/page.tsx`, `checkin/page.tsx` — placeholders until 3.3b (plan wizards) and 3.3c
  (check-ins)
