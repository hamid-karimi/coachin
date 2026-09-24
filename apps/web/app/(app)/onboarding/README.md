# Onboarding module — "My week" commitments editor

`/onboarding` is where users manage their **recurring weekly commitments**. It doubles as
the first-run flow (Finish goes to Today) and stays reachable afterwards (Today → "Edit my
week"; later also Calendar and Training). The Training nav tab is highlighted here.

## Commitments model

Two commitment types (`FORMULAS.md` §11):

- **Fixed session (anchor)** — sport + day + optional time + optional repeat-until, stored
  in `schedules`. Anchors are the streak's "required days".
- **Weekly target (quota)** — sport × N sessions per week (1–14), no fixed day, stored in
  `weekly_quotas` (one per user × sport; saving again updates it). Progress = distinct
  days this Mon–Sun week with a completed log of the sport. **Informational only.**

The newest active AI plan's current week shows read-only beside them (edited in Training).

## API (Go: `apps/api/internal/app/routine`)

| Call | What |
| --- | --- |
| `GET /sport-types` | Selectable sports with their effective XP multiplier |
| `GET /routine` | `schedules`, `quotas` (with `doneThisWeek`), `planItems`, `estimatedWeeklyXp` |
| `POST /routine/schedules` | `{sportTypeId, days[], time?, endsOn?}` → one row per day (the UI sends one day) |
| `DELETE /routine/schedules/{id}` | Remove a fixed session (idempotent) |
| `PUT /routine/quotas/{sportTypeId}` | `{sessionsPerWeek}` — create or update the target |
| `DELETE /routine/quotas/{sportTypeId}` | Remove the target (idempotent) |

Every mutation returns `{status, message}` (the legacy toast copy). Validation messages
are the legacy ones ("Please pick at least one day.", "Sessions per week must be between
1 and 14.", "Unknown sport. Please pick one from the list.", …).

## Structure

- `page.tsx` — prefetches `/routine` + `/sport-types` on the server and hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-routine.ts` — `useRoutine`, `useSportTypes` (suspense queries on the hydrated
  cache) and one mutation hook per call; each toasts the result and refetches `/routine`
  (`components/hooks/use-mutation-feedback.ts`)
- `hooks/use-today-dow.ts` — the viewer's weekday, client-only (no hydration mismatch)
- `lib/commitments.ts` — sheet + fixed-session reducers (lookup maps), validation,
  `plannedDays`, stepper bounds (unit-tested)
- `components/`
  - `add-commitment-sheet.tsx` — "Add to my week" + the two-step bottom sheet
  - `sport-picker.tsx`, `commitment-type-switch.tsx`, `commitment-details-step.tsx`
  - `add-fixed-session-form.tsx` — day strip (dots on already-planned days), time,
    repeat-until; Add always enabled, invalid submits point at what's missing
  - `add-weekly-target-form.tsx` — 1–14 stepper
  - `weekly-target-list.tsx` — "n/m this week" rows with remove
  - `week-agenda.tsx` — Monday-first day rows: routine cards (remove) + AI plan cards
    (open `plan-session-sheet.tsx`); empty-week guidance
  - `routine-session-card.tsx`, `plan-session-card.tsx`, `plan-type-icon.tsx`
  - `complete-onboarding-button.tsx` — "N days planned · est. ~X XP / week" + Finish
  - `page-header.tsx`, `types.ts` (API schema aliases)

Shared: `lib/week-days.ts`, `lib/sports.ts` (name → icon bucket), `lib/plan-items.ts`
(detail line, type label, video URL) — all unit-tested.

## Differences from legacy

- The unused inline `DaySportPicker` / `useAddSession` were not ported.
- Deleting a session or target is scoped to the signed-in user (legacy RLS also let a
  coach delete a trainee's schedule from this screen; coach editing arrives with the
  coaching module).
- The "today" highlight uses the viewer's device date after hydration.
