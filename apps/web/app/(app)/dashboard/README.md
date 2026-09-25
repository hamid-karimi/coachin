# Dashboard module — "Today"

The daily execution surface: see today's plan, log it, watch XP and the streak move.

## API (Go: `apps/api/internal/app/today`, `app/training`)

| Call | What |
| --- | --- |
| `GET /today` | Settles the streak for past days (`streak.SettleRange` under the profile lock), then returns `stats` (XP, level progress, streak, hearts, tier), today's fixed `sessions` (with `completed`, `estimatedXp`), today's `planItems` blended across every active plan (each in its own week), `planWeek`, `hardCollision`, `doneCount`/`totalCount` (meal notes excluded), weekly-target `quotas`, `progressPhoto` nudge, `mealPlan` (today's menu and the daily kcal target; absent without an active meal plan) |
| `POST /today/workouts` | `{sportTypeId}` → `round(60 × multiplier)` XP; log, ledger row, and balance in one transaction; once per sport per day (409 otherwise) |
| `POST /supplements` · `PUT /supplements/{id}/schedule` · `DELETE /supplements/{id}` · `PUT /supplements/{id}/taken` | Daily stack (max 20); the stack with `dueToday`/`takenToday` comes with `GET /today` |
| `PUT /plan-items/{id}/completion` | `{completed}` → XP delta (`+60/+30/+20` by type, compensated on undo); done only on the item's day or the day after |
| `POST /plan-items/{id}/session-log` | Run/strength "how did it go": `{sport, rpe?, note?, distanceKm?, durationMin?, avgHr?, exercises?}` → log + item done + `session_log:<id>` (+10, once) in one transaction under the profile lock, then AI feedback (non-fatal); `{message, awardedXp, feedback?, totalVolumeKg}`; 409 "Session already logged" |

## Structure

- `page.tsx` — prefetches `/today` and `/goals` (+ `getMe` for the name) and hydrates; no
  logic
- `loading.tsx` — skeleton
- `hooks/use-supplements.ts` — add / reschedule / remove / taken, each refetching Today
- `lib/supplements.ts` — schedule options, Sunday-first weekday chips, `toggleDay`,
  `scheduleBody`, `dueChecklist` (unit-tested)
- `components/coaching-card.tsx` — coach-capable roles with 1+ trainee: "Coaching · 2
  trainees · 1 trained this week" → `/coaching` (`GET /coaching/summary`, prefetched only
  for coaches)
- `components/group-nudge.tsx` — Community on, nothing logged today, a group with a live
  streak: "Dawn Patrol's 4-day streak needs you" → `/community/groups`
  (`GET /community/group-nudge`, prefetched only while the flag is on)
- `components/goal-strip.tsx` — the tracked goal closest to done ("Weight goal · 74.6kg →
  72kg" + bar) linking to the profile; hidden without one (`profile/lib/profile.ts`
  `featuredGoal`)
- `components/todays-meals-card.tsx` — "Today's meals" from the active meal plan
  (hidden without one), "Full meal plan" link, "N kcal planned · target X"
- `hooks/use-today.ts` — `useToday` (suspense query), `useLogWorkout` (refetches Today,
  My week, and the group nudge)
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
  - `supplements-card.tsx` — "Daily stack": due-today checklist + "x of y taken", manage
    sheet (`add-supplement-form.tsx`, `managed-supplement-row.tsx` with inline schedule
    edit, `schedule-fields.tsx`), `supplement-item.tsx` (optimistic check)
  - `workout-card.tsx` — pending → "Log it" → reward state (XP, next streak, confetti);
    done state for sports logged earlier today

Shared: `app/(app)/components/plan-item-row.tsx` + `app/(app)/hooks/use-plan-item-completion.ts`
(optimistic done toggle, used by Training and Calendar later); under a done run/strength
item, `session-log-sheet.tsx` ("Log details": `rpe-picker`, `run-log-fields`,
`strength-sets-editor`, `session-log-result`; `hooks/use-session-log.ts`; logic in
`lib/session-log.ts`, `lib/strength-sets.ts`, `lib/workout-sets.ts` — the last replays
the API's `workout-sets.json` golden vectors),
`components/hooks/use-confetti-burst.ts` (colors from theme tokens). After a strength log
with weights, "Share it" (design-system `share-button` → `share-card-sheet`) builds the
session card: kg lifted, exercises, sets, and the equivalence line (`lib/share-card.ts`).

## Differences from legacy

- A second log of the same sport on the same day is refused by the API (legacy only hid
  the button); the XP ledger reason carries the date.
- The plan-item log window is enforced by the API too, not only by the disabled button.
- A session log, the item's done flag, and its +10 XP are one transaction (legacy ran
  three calls, so a failure could leave a log without XP).
- A sport with no multiplier earns 60 XP (legacy produced NaN).
- Editing a supplement's schedule saves (legacy lacked the database UPDATE policy);
  checking off another user's supplement is refused (legacy only checked the log's owner).
