# Adherence + supplements — execution plan

Branch `feat/adherence-supplements` off `develop`. Three features from the
2026-07-09 brainstorm, build order **A → B → C** (schedules is self-contained;
coach view piggybacks on it; calendar adherence is the most UI-sensitive).

Owner decisions (brainstorm, 2026-07-09):

- **No new XP anywhere.** Meal adherence is display-only; supplements stay
  XP-free (FORMULAS §13). Kcal self-reports and checkbox habits are trivially
  gameable — don't gamify them.
- **No title/AI matching for meal adherence** — logs are foods (search/photo/
  manual), plan items are AI dish titles; they never string-match. Adherence =
  meal-type **slots filled** + **kcal ratio** vs the plan. Deterministic, pure,
  testable.
- **No cron builder for supplements** — due-days only (daily / training days /
  custom weekdays). Times of day stay in the free-text `dose` field
  ("5g after training"); no notifications (no push infra).
- **Coach visibility reuses `profiles.nutrition_sharing_enabled`** — the stack
  is nutrition-adjacent; one consent flag, same as meals. Coach is read-only.

Per phase: implement → `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>`
· `pnpm test` → commit. Final phase adds `pnpm build` + docs sweep
(FORMULAS.md notes, QA-ONBOARDING.md, module READMEs, WORKLOG.md).

## Phase 0 — discovery (done, evidence inline)

- **Coach-read RLS pattern**: `coaching_relationships` EXISTS clause
  (`cr.status='active' AND cr.coach_id=auth.uid() AND cr.student_id=<row>.user_id`)
  — `20260704120000_logs_policies_coach_read.sql:11-24`. The **nutrition
  variant to copy** additionally ANDs an EXISTS on
  `profiles.nutrition_sharing_enabled`:
  `20260707131000_nutrition_coach_read.sql:17-38` (meal_logs policy).
- **Supplements schema**: `20260708090000_supplements.sql` — `supplements`
  (id, user_id, name, dose, created_at), `supplement_logs`
  (UNIQUE (supplement_id, date)); **self-only RLS today** — coach read needs a
  new migration (Phase B blocker, by design).
- **Supplements actions**: `app/dashboard/supplements-actions.ts` —
  `addSupplementAction` (name ≤60, dose ≤40, MAX_SUPPLEMENTS=20),
  `deleteSupplementAction`, `toggleSupplementLogAction` (insert/delete log for
  `toLocalYMD(new Date())`, 23505 tolerated). All
  `(prevState, formData) => SupplementActionState`, `revalidatePath("/dashboard")`.
- **Dashboard wiring**: `app/dashboard/page.tsx` fetches
  `supplements (id, name, dose)` + today's `supplement_logs` in the big
  `Promise.all` (~169-178), passes to `<SupplementsCard supplements takenIds>`
  (~548-551). Dashboard ALREADY computes today's plan items: active plans
  (~155-160) → `planWeekForDate(plan.created_at, today)` + `.eq("day_of_week",
  today.getDay())` (~205-231) — reuse this to derive `isTrainingDay`.
- **Training weekdays**: `plan_items.day_of_week smallint 0=Sun…6=Sat`
  (`20260705100000_training_plans.sql:35`), plan-relative `week`; recurring
  routine lives in `schedules` (weekday-based, see calendar page ~82-113).
- **Calendar**: single-week vertical list (Mon-first), one bordered card per
  day (`app/calendar/page.tsx:264-358`). Meals link is inline JSX (~345-354):
  `{dayMeals.length} meals planned · {kcal} kcal` → `/nutrition/plan`, fed by
  `getActiveMealPlanByDay` (`app/nutrition/lib/meal-plan-day.ts`, weekday-keyed
  `byDay` map + `kcalTarget`). Only "today" is styled (`isToday`, ~268, 293);
  past/future cells render identically — adherence must add its own
  `ymd <= todayYmd` check.
- **meal_logs**: date, `meal_type IN ('breakfast','lunch','dinner','snack')`,
  kcal (`20260705120000_nutrition.sql`).
- **Coach nutrition surface**: `app/coaching/lib/trainee-nutrition-data.ts`
  (authorizes via `coaching_relationships`, returns
  `{trainee, sharingEnabled, days, targets}`);
  `app/coaching/components/TraineeNutritionSection.tsx` (sharing-off card,
  empty card, DayCards); host page
  `app/coaching/trainees/[id]/nutrition/page.tsx` renders the section at ~58 —
  new supplements section slots in right after.
- **Test convention**: vitest, `import { describe, expect, it } from "vitest"`,
  relative SUT import, colocated `lib/*.test.ts` (e.g. `lib/plan-items.test.ts`,
  `lib/week-days.test.ts`).
- **Docs**: FORMULAS.md `## 13. Supplements (daily stack)` (line ~313);
  QA-ONBOARDING.md journeys — §4 Calendar (~95), §5 Nutrition (supplements
  sub-step ~129), §6 Coaching (nutrition sharing sub-step ~146).

Anti-patterns (global): no `coach_students` / `profiles.coach_id` (the
relationship table is `coaching_relationships`); no new consent flag (reuse
`nutrition_sharing_enabled`); no XP/streak/heart writes anywhere in these
features; `lib/` helpers stay framework-free (no supabase imports — pass data
in).

## Phase A — supplement schedules

1. Migration `2026MMDDHHMMSS_supplement_schedules.sql`:
   `ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS schedule_type text
   NOT NULL DEFAULT 'daily' CHECK (schedule_type IN
   ('daily','training_days','custom'))`, `ADD COLUMN IF NOT EXISTS
   days_of_week smallint[]` (custom only; 0=Sun…6=Sat, same convention as
   `plan_items.day_of_week`). Existing rows read as `daily` — zero behavior
   change.
2. `lib/supplement-schedule.ts` (pure) + colocated test:
   `isSupplementDue({scheduleType, daysOfWeek}, {weekday, isTrainingDay})` —
   daily → true; training_days → `isTrainingDay` (callers pass `true` when the
   user has NO active training plan, so it degrades to daily); custom →
   `daysOfWeek?.includes(weekday)` (empty/null custom → true, never strand a
   supplement). Also `scheduleLabel(...)` → "Every day" / "Training days" /
   "Sun · Tue · Thu" for UI reuse (dashboard + coach view).
3. `app/dashboard/supplements-actions.ts`: `addSupplementAction` accepts
   `schedule_type` (validated against the enum, default daily) and
   `days_of_week` (multi-value checkbox field, ints 0-6, only for custom);
   new `updateSupplementScheduleAction` (supplement_id + same fields,
   self-scoped update). Insert/update include the new columns.
4. Dashboard: `app/dashboard/page.tsx` selects the new columns; derive
   `isTrainingDay` = (today's plan items ≠ empty) OR (a `schedules` routine
   session falls on today's weekday — the page already loads both). Pass
   supplements + dueness to the card. `SupplementsCard`: checklist shows ONLY
   due-today supplements; "X of Y taken" counts due ones; manage sheet lists
   ALL supplements with `scheduleLabel`, and the add form + row edit get a
   schedule picker (select + 7 weekday checkboxes shown only for custom).
   Component stays presentational — dueness computed in the page/lib.

Verify: unit tests for every schedule_type × training-day combo; existing
supplements show unchanged (daily). Guards: no times-of-day columns; no
notification code; `supplement_logs` untouched (logging a non-due supplement
via old UI state must not error — toggle action stays schedule-agnostic).

## Phase B — coach visibility of the daily stack

1. Migration `2026MMDDHHMMSS_supplements_coach_read.sql`: copy the meal_logs
   coach-read SELECT policy from `20260707131000_nutrition_coach_read.sql:17-38`
   verbatim onto `supplements` and `supplement_logs` (rename policies, e.g.
   `supplements_select_self_or_coach`; drop-and-recreate the self select
   policies as the nutrition migration does). Both EXISTS clauses:
   active `coaching_relationships` AND `profiles.nutrition_sharing_enabled`.
   SELECT only — insert/update/delete stay self-only.
2. `app/coaching/lib/trainee-supplements-data.ts`: follow
   `trainee-nutrition-data.ts` structure — authorize via
   `coaching_relationships` (return null if not the coach's active student),
   read `nutrition_sharing_enabled`, fetch `supplements` + last-7-days
   `supplement_logs`, compute per-supplement `takenLast7 / dueLast7` using
   `isSupplementDue` per day (training days per weekday from the trainee's
   active plan items — fetch under existing coach-read RLS on plan tables; if
   unreadable, treat all days as due-eligible and label plainly).
3. `app/coaching/components/TraineeSupplementsSection.tsx`: mirror
   `TraineeNutritionSection` states (sharing-off explainer / empty stack /
   list). Row: name · dose · `scheduleLabel` · "5/7 due days". Read-only — no
   actions.
4. Host page `app/coaching/trainees/[id]/nutrition/page.tsx`: load both
   datasets, render the new section under `<TraineeNutritionSection>`.
5. Dashboard manage-sheet description gains: "Visible to your coach when
   nutrition sharing is on."

Verify: with sharing OFF the coach queries return empty (RLS) and the section
shows the explainer; coach cannot mutate (no actions exposed; RLS blocks).
Guards: no separate supplements consent flag; no coach editing; don't count a
day as "due" before the supplement's `created_at` date.

## Phase C — per-date meal adherence on calendar

1. `lib/meal-adherence.ts` (pure) + colocated test:
   `mealAdherenceForDay(planned: {meal_type, kcal}[], logged: {meal_type,
   kcal}[])` → `{slotsPlanned, slotsLogged, kcalPlanned, kcalLogged,
   kcalRatio: number | null}`. Slot = distinct meal_type; a slot is "logged"
   when any log of that meal_type exists that date (extra snacks/types beyond
   the plan are ignored, not penalized); `kcalRatio` null when kcalPlanned is
   0. No verdict thresholds in v1 — return numbers, let the UI phrase them.
2. `app/calendar/page.tsx`: when `mealPlanByDay` exists, add ONE query to the
   week's data loading: `meal_logs` `select("date, meal_type, kcal")` for
   `user.id` between the week's first/last YMD. Group by date.
3. Day cells: for days with `ymd <= todayYmd` AND planned meals, render a
   single muted adherence line next to the existing meals link, e.g.
   `2/3 meals logged · 85% of plan kcal` (0 logged → "no meals logged").
   Future days keep the current "N meals planned · X kcal" link untouched.
   Calendar stays training-first: one `text-muted-foreground` line, no
   colors/scores/emoji, no new component unless the cell JSX gets crowded —
   then extract `app/calendar/components/day-meals-line.tsx`.

Verify: unit tests — full/partial/zero adherence, extra unplanned meal types,
kcalPlanned=0, multiple logs of one type count once; page renders with and
without an active meal plan (chip absent without). Guards: display-only (no
XP/streak/heart writes — FORMULAS §13 extended, see docs); no title matching;
no per-day AI calls; don't regress the future-day meals link.

## Final — verification + docs

1. `pnpm exec tsc --noEmit` · eslint changed files · `pnpm test` ·
   `pnpm build`.
2. Docs, same change: FORMULAS.md §13 — schedules (due-day rule) + a line that
   meal adherence and supplement taken-rates are informational (no XP/streaks/
   hearts/quotas); QA-ONBOARDING.md — journey 4 (calendar adherence line),
   journey 5 sub-step 5 (schedules picker, due-only checklist), journey 6
   (coach sees Daily stack with nutrition sharing on/off); nutrition README
   (adherence semantics), dashboard README if present; WORKLOG.md entry.
3. Grep guards: no `coach_students`; no XP writes in new files
   (`grep -n "xp" <new files>` → only comments/docs); `lib/meal-adherence.ts`
   and `lib/supplement-schedule.ts` import nothing from supabase/next.

Post-merge (Hamid): apply the two new migrations to hosted Supabase; QA per
updated journeys 4/5/6.
