# Training module — "My programs"

`/training` is the program manager: every active plan (one per discipline) as a compact
card; the day-by-day schedule lives in Calendar, logging happens on Today.

## API (Go: `apps/api/internal/app/training`)

| Call | What |
| --- | --- |
| `GET /training/programs` | Active plans (ordered by plan kind: hypertrophy, then race) with `currentWeek`, `daysUntilRace`, `fromCoach` (creator ≠ owner), `reviewWeek` (last fully elapsed week), `checkinDue` (a next week exists and no check-in yet) |
| `POST /training/plans/{id}/archive` | Archive (progress kept); a no-op for other users' or already archived plans |
| `GET /training/calendar.ics` | All active plans' sessions as all-day events (meal notes excluded); 404 without an active plan |
| `GET /training/intake-context?student=` | Whose plan the wizard builds (self or a coached trainee) and their body profile; 403 for coach mode without an active relationship |
| `POST /training/plans/running` | Validates the wizard (legacy messages), generates with AI (Claude → Gemini), saves via `create_training_plan`; replaces the same-discipline active plan. 502 when AI is unavailable |
| `POST /training/plans/hypertrophy` | Same for muscle building |
| `PUT /plan-items/{id}/completion` · `POST /plan-items/{id}/session-log` | Done/undo and "Log details" (see the dashboard README) |
| `GET /training/plans/{id}/checkin` | The check-in proposal, 404 unless one is due (a fully elapsed week that is not the last, not yet reviewed, with a next week): `scorecard` of the reviewed week (+ stalled-lift cautions from week 3), `decision` + `reasons` (FORMULAS.md §7), and next week's `items` rewritten by the AI within that decision — or unchanged with "Keeping week N as planned. …". Each call is an AI call (rate limited) |
| `POST /training/plans/{id}/checkin` | `{checkinWeek, summary, items}` → `apply_week_adjustment`: records the check-in, rewrites **only** the target week, +20 XP once. The scorecard and decision are recomputed here (legacy trusted the posted ones); items are revalidated like generated plans and forced onto the target week; 409 when the week moved on or was already checked in |

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
- `new/page.tsx` — server page: loads the intake context (`app/lib/intake-data.ts`),
  redirects coach-mode misuse, renders the chooser or a wizard
- `components/plan-kind-chooser.tsx`, `running-wizard.tsx` (+ `running-background-step`,
  `running-goal-step`), `hypertrophy-wizard.tsx`, `profile-card.tsx`, `wizard-fields.tsx`
- `lib/running-wizard.ts` (draft reducer, derived labels, request body),
  `lib/hypertrophy-wizard.ts`, `lib/intake.ts` (profile summary) — unit-tested;
  `lib/running.ts` (goal suggestion) replays the API's `running.json` golden vectors
- `hooks/use-generate-plan.ts` — generation mutations (toast, refetch, go to programs or
  Coaching)
- `checkin/page.tsx` — loads the proposal once on the server (`app/lib/checkin-data.ts`;
  never refetched in the browser, as each fetch is an AI call), redirects to `/training`
  when none is due; `checkin/loading.tsx` while the AI works
- `components/checkin-view.tsx` (stat cards, flags, decision, proposed week) +
  `confirm-checkin-button.tsx`; `hooks/use-confirm-checkin.ts` (refetches programs,
  Today, My week, then back to `/training`); `lib/checkin.ts` (decision copy, flag list,
  confirm body; unit-tested)

The watch-file upload step of the legacy running wizard returns with FIT/GPX parsing
(3.3d).
