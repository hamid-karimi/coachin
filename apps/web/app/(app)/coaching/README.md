# Coaching module

The coach hub: trainees with this week's adherence, invite codes, and a weekly-XP ranking;
per-trainee actions (assign the coach's routine, generate an AI plan for them, read their
shared nutrition). Coach-capable roles only (`coach`, `both`, `admin`); anyone else is
sent to `/dashboard` (the API answers 403).

## API (Go: `apps/api/internal/app/coaching`)

| Call | What |
| --- | --- |
| `GET /coaching` | `weekStart` (Monday) and `trainees` — one row per active relationship: name, email, avatar, level, XP, tier, sport, `weeklyXp` (`get_weekly_leaderboard`, called with the coach's trainee ids only), `week` (7 dots Mon→Sun: done / missed / planned_today / planned / rest — `domain/coaching.WeekStrip`), `doneCount` / `scheduledCount`, `plans` (each active plan's current-week adherence, the check-in math, FORMULAS §7), `nutritionShared` — plus the coach's `inviteCodes` |
| `GET /coaching/summary` | `traineeCount`, `trainedThisWeek` (Today's card) |
| `POST /coaching/invite-codes` | `{sportTypeId}` → a new `COACH-<sport>-<6 chars>` code (no look-alike characters), replacing the coach's code for that sport |
| `POST /coaching/join` | `{code}` (trimmed, upper-cased) → "Coach added successfully." / "Coach connection reactivated successfully." / "You’re already connected to this coach." (`join_coaching_via_invite_code`); 400 "Invalid invite code", 403 for coach-only roles; rate limited |
| `POST /coaching/trainees/{id}/weekly-plan` | Replaces the trainee's routine with the coach's (`assign_coach_schedule_to_student`); 400 "No active coaching relationship found" / "Coach has no schedule to assign" |
| `GET /coaching/trainees/{id}/nutrition` | Active relationship only (404 otherwise). With the trainee's sharing opt-in: the last 7 days' meals grouped by day (newest first, totals), the active meal plan's kcal / protein targets, and the daily stack with each supplement's "taken / due days" over the window (`supplements.Window` + `TakenRateOver`, FORMULAS §13). Without it: only `sharingEnabled: false` |

Coach-mode plan generation (`/training/new?student=<id>`) shipped with Training (3.3).

## Structure

- `page.tsx` — role guard (`getMe` + `lib/roles.canCoach`), prefetches `/coaching` and
  `/sport-types`; `loading.tsx`
- `trainees/[id]/nutrition/page.tsx` — role guard, prefetches the trainee view
- `hooks/use-coaching.ts` — hub + sport queries, invite code and assign mutations
- `lib/coaching.ts` — roster lines, off-track chips (< 50%), weekly ranking, nutrition
  view lines (targets, day kcal badge, taken rate) — unit-tested
- `components/`
  - `coaching-view.tsx` — header, roster (`trainee-row.tsx` with
    `design-system/adherence-week-strip` and `assign-plan-button.tsx`),
    `invite-codes-card.tsx`, `trainee-leaderboard.tsx` (`design-system/leaderboard-row`)
  - `trainee-nutrition-view.tsx` — day cards and the daily stack, or the opt-in
    explainer
- Elsewhere: Today's `dashboard/components/coaching-card.tsx`; Profile → Settings
  `join-coach-form.tsx` (while Community is off)

## Differences from legacy

- Weekly XP is read for the coach's own trainees only; nothing on the hub falls back to
  platform-wide numbers.
- Trainee nutrition returns nothing (not just empty lists) without the opt-in, and the
  supplements' taken rate is computed by the API (legacy computed it in the page).
- Trainee photos stay private to the trainee (no coach access, as in legacy).
