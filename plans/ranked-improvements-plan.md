# Ranked improvements — execution plan

Owner decisions baked in: coach AI plans apply **directly** to the trainee (no acceptance
step); diet sharing grants the coach **full** nutrition log access (trainee opt-in); QA
deliverable is an onboarding **markdown doc**.

Working branch: `feat/ranked-improvements` (off `develop`). Per phase: implement →
verify (`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed files>` · `pnpm test`) →
commit. Follow `.claude/skills/coding-style/SKILL.md`. `FORMULAS.md` is authoritative —
no phase changes XP math; Phase 4 explicitly keeps volume out of XP.

## Phase 0 — Discovery (done)

Facts below were verified against the codebase on 2026-07-07. Key references:

- AI item schema `PlanItemInput` (`title`, `details{distance_km?,pace_min_km?,duration_min?,notes?,video_query?}`):
  `lib/ai/marathon.ts:45-64`, validation `validateItems` `lib/ai/marathon.ts:82-131`
  (title sliced to 200 chars at ~104). Hypertrophy reuses the same schema
  (`lib/ai/hypertrophy.ts:10`).
- `plan_items` table: `supabase/migrations/20260705100000_training_plans.sql:31-49`
  (`title text NOT NULL`, `details jsonb`, **no description column**).
- `create_training_plan` RPC (current version):
  `supabase/migrations/20260706140000_multi_active_plans.sql:25-98` — 9 params, hardcodes
  `v_user_id := auth.uid()`, archives prior active plan of same `plan_kind`, inserts items
  `(plan_id, week, day_of_week, item_type, title, details)`.
- Title render sites: `app/calendar/components/day-plan-items.tsx:65` (+sheet 96-116),
  `app/onboarding/components/PlanSessionCard.tsx:41`,
  `app/onboarding/components/PlanSessionSheet.tsx:54`,
  `app/training/components/plan-item-row.tsx:132`,
  `app/training/calendar.ics/route.ts:91-111` (SUMMARY=title).
- `PlanWeekItem` type duplicated in `app/dashboard/page.tsx`, `app/calendar/page.tsx`,
  `app/onboarding/actions.ts`.
- Log flow: `togglePlanItemAction` (`app/training/actions.ts:434-475`, RPC
  `complete_plan_item`), `logSessionAction` (`app/training/actions.ts:517-663`, inserts
  `session_logs`, RPC `award_session_log_xp` = fixed +10 idempotent,
  `supabase/migrations/20260705150000_session_logs.sql:52-100`).
- `session_logs`: `actual jsonb`, `rpe`, `note`, UNIQUE(plan_item_id); strength exercises
  serialized from `SessionLogSheet` (`app/training/components/session-log-sheet.tsx`,
  `ExerciseRow {name, sets, reps, weight_kg}` → `actual.exercises`). Log window:
  `withinLogWindow` `app/training/components/plan-item-row.tsx:68-77`.
- Calendar routine rows: `app/calendar/page.tsx:268-346` — static, no onClick; data:
  schedule id, sport name/icon, time, "routine" badge. Onboarding routine cards:
  `RoutineSessionCard` (editable), `WeekAgenda.tsx:144-160`.
- Onboarding forms: `AddFixedSessionForm.tsx` (`canSubmit` line 38, disabled button line
  135), `AddWeeklyTargetForm.tsx` (same pattern), `SportPicker.tsx` (chips,
  `value/onChange`), server validation already in `app/onboarding/actions.ts:125-127`.
- Bottom sheet primitive: `components/design-system/bottom-sheet.tsx` (hand-rolled,
  mobile slide-up / desktop dialog, Escape/overlay/X close). Confirm dialog similar.
- `sport_types`: `id bigint identity, name text (no unique), xp_multiplier real` —
  **no seed migration exists**; icons derived via `sportFromName` (`lib/sports.ts`) +
  `SPORTS` map in `components/design-system/sport-chip.tsx` (running/strength/swimming/
  cycling/mobility). Dedup precedent: `20260706140000_dedup_mobility_sport_types.sql`
  (idempotent PL/pgSQL DO block).
- Confetti: `canvas-confetti` dynamic-import pattern in
  `app/dashboard/components/workout-card.tsx:39-79`.
- Roles: `lib/roles.ts` (`COACH_ENABLED_ROLES={coach,both,admin}`, `canCoach`).
  Relationships: `coaching_relationships` (coach_id, student_id, sport_type_id,
  status active/inactive, UNIQUE triple) `20260212010000_social_coaching_mvp.sql:24-48`.
- Coach-read RLS pattern to copy: `20260704120000_logs_policies_coach_read.sql:11-24`
  (`EXISTS` on active coaching_relationships).
- Nutrition: `meal_logs` (`20260705120000_nutrition.sql:38-56`, RLS self-only),
  `meal_plans` + `meal_plan_items` (`20260706130000_meal_plans.sql`, RLS self-only).
- `profiles`: no sharing flag yet. `training_plans`: no `created_by` column.
- Coaching hub: `app/coaching/page.tsx`, `lib/coaching-hub-data.ts`,
  `TraineesSection.tsx` (per-trainee row + `AssignPlanButton`).
- Wizards: `intake-wizard.tsx` / `hypertrophy-wizard.tsx` — `<form action={serverAction}>`
  + hidden inputs; props `{profileSummary, hasBodyProfile}`.
- Tests: vitest, `lib/**/*.test.ts` colocated (pattern: `lib/schedule-inserts.test.ts`).
- Migration naming: `YYYYMMDDHHMMSS_desc.sql`; latest is `20260707100000_weekly_quotas.sql`
  — new migrations must sort after it.

## Phase 1 — Short plan-item titles + description

**What:**
1. Migration `2026070712xxxx_plan_items_description.sql`: `ALTER TABLE plan_items ADD
   COLUMN description text` (nullable); update `create_training_plan` RPC to also insert
   `description` from each item jsonb (`item->>'description'`); **backfill** existing rows
   where `char_length(title) > 60 OR title LIKE '% + %'`: `description = title`,
   `title = <item_type label>` ('Strength session', 'Run', 'Mobility', 'Recovery',
   'Stretch', 'Meal note') via CASE. Idempotent DO-block style like the dedup migration.
2. `lib/ai/marathon.ts`: add `description?: string` to `PlanItemInput`; validate (string,
   slice ~2000); tighten title guidance — prompts (marathon + hypertrophy) must demand a
   short human title (≤60 chars, e.g. "Upper body — Day A") and put the full exercise
   list/details into `description`. Keep title slice as backstop.
3. Types: add `description: string | null` to the `PlanWeekItem` shapes and calendar item
   type; select `description` in the three fetch sites.
4. Rendering: title stays the card text; show `description` in `PlanDetailSheet`
   (day-plan-items), `PlanSessionSheet`, `PlanItemRow` (below detail line, muted, like
   notes), and `.ics` DESCRIPTION (before notes). Don't render null/empty.

**Anti-patterns:** don't rename `details`→`description` (details jsonb stays); don't make
column NOT NULL; don't touch XP.

**Verify:** tsc/eslint/tests; grep confirms all five render sites handle description;
migration file parses (`supabase db` not run locally — review SQL carefully).

## Phase 2 — Log affordance for routine sessions

**What:**
1. New client component `app/calendar/components/routine-session-item.tsx`: makes the
   calendar routine row a button opening a `BottomSheet` (copy `PlanDetailSheet` shape in
   `day-plan-items.tsx:89-141`): sport name/icon, time, "routine" badge, and a primary
   action — if the session's date is **today**: link "Log it on Today" → `/dashboard`;
   otherwise a muted hint "You can log this from Today on its day." Replace the static
   markup in `app/calendar/page.tsx:319-346` with it (server page passes plain props).
2. Onboarding `PlanSessionSheet` untouched; `RoutineSessionCard` stays an editor (that
   page is the routine editor, not a tracker) — but add the same "Log it on Today"
   link inside the calendar sheet only. (Scope decision: dashboard WorkoutCard already
   logs routines on their day.)

**Anti-patterns:** no new logging path (reuse Today's WorkoutCard flow); no searchParams
plumbing into /dashboard; keep server page orchestration-only.

**Verify:** tsc/eslint/tests; calendar page still compiles as server component with the
new client leaf.

## Phase 3 — Add-commitment form UX + more sports

**What:**
1. Always-enabled Add: in both add forms drop `!canSubmit` from `disabled` (keep
   `isPending`); on invalid submit prevent the action and set an inline pointing message
   (e.g. "Pick a sport first" / "Pick at least one day") rendered near the offending
   control (`text-destructive text-sm`, `aria-live="polite"`); clear on selection.
2. Stepwise sheet: new `AddCommitmentSheet` client component wrapping the existing two
   forms in `components/design-system/bottom-sheet.tsx`; `AddCommitmentSection` becomes a
   prominent "Add to my week" button that opens it. Step 1: pick sport (SportPicker);
   step 2: fixed-day(s)+time or weekly target (keep the segmented control inside the
   sheet). Reuse the existing forms' internals — restructure, don't rewrite actions.
3. Sports seed migration `2026070712xxxx_seed_sport_types.sql`: idempotent
   INSERT-where-not-exists (name-based) for: Football, Basketball, Boxing, Tennis,
   Volleyball, Martial arts, Climbing, Hiking, Rowing, Dance, Table tennis, Badminton
   (xp_multiplier 1.0). Extend `sportFromName` + `SPORTS` map with new categories
   (`ball_sports`→lucide icon, `combat`, `climbing`, `outdoor`, `dance` — pick sensible
   lucide icons; unknown still falls back). Update `lib/sports.test.ts` if present, else
   add one.

**Anti-patterns:** don't drop server-side validation; don't add a dep (no Radix/vaul —
BottomSheet exists); don't create disabled-button-with-tooltip patterns.

**Verify:** tsc/eslint/tests; Storybook story for the new sheet states
(sport-not-picked error, step 2) if straightforward.

## Phase 4 — Per-set logging + volume celebration

**What:**
1. `lib/workout-sets.ts` (pure, unit-tested): types `SetEntry {weight_kg, reps}`,
   `LoggedExercise {name, sets: SetEntry[]}`; `totalVolumeKg(exercises)`;
   `volumeEquivalence(kg)` from a desc-sorted lookup table (e.g. 4000 elephant, 1500 car,
   700 grand piano, 400 horse, 180 refrigerator, 80 washing machine…) returning
   `{label, emoji}`; `parsePrescription(text)` parsing "DB Goblet Squat 3x10-12 + …"
   (split " + ", regex `(\d+)x(\d+)(?:-(\d+))?`) → `{name, sets, repsLow, repsHigh}`[] —
   tolerant, returns [] on no match.
2. `SessionLogSheet` strength mode: per-set rows. Prefill from
   `parsePrescription(item.description ?? item.title)`: one exercise block per parsed
   exercise, N set rows each (weight blank, reps = repsLow). Add/remove set + exercise.
   Serialize to `actual.exercises = [{name, sets:[{weight_kg, reps}]}]` (new shape;
   server accepts both old and new). Show live total volume in the sheet footer.
3. `logSessionAction`: accept the new sets payload (validate numbers server-side);
   store in `actual`; **no XP change** (`award_session_log_xp` untouched). Return
   `totalVolumeKg` in the success state.
4. Celebration: on save success, confetti (copy `workout-card.tsx:39-79` pattern) +
   message "You lifted 1,540 kg total — that's a small car 🚗" via the success toast.

**Anti-patterns:** DO NOT touch `award_session_log_xp`, `xp_transactions`, FORMULAS.md
XP tables; no schema migration needed (`actual` is jsonb); don't break old-shape logs
(reader must handle `{sets,reps,weight_kg}` rows).

**Verify:** unit tests for volume/equivalence/parser incl. edge cases; tsc/eslint/tests.

## Phase 5 — Coach arc (AI plans for trainees + diet sharing)

**What:**
1. Migration A `2026070713xxxx_coach_created_plans.sql`: `ALTER TABLE training_plans ADD
   COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL`; replace
   `create_training_plan` with added `p_target_user_id uuid DEFAULT NULL` — if NULL,
   behave as today; if set and ≠ auth.uid(), require active `coaching_relationships`
   (coach_id=auth.uid(), student_id=p_target_user_id) else return error; plan `user_id` =
   target, `created_by` = auth.uid(). Also ensure trainee can SELECT the plan (existing
   self policies keyed on user_id still work).
2. Actions: `generatePlanAction` + `generateHypertrophyPlanAction` read optional
   `target_student_id` from formData; when present: `canCoach(role)` + active-relationship
   check, fetch the **trainee's** profile summary/body metrics and schedules-as-anchors
   instead of the coach's, pass `p_target_user_id`. Revalidate `/coaching`.
3. UI: wizards get optional `targetStudentId?: string` + hidden input;
   `app/training/new/page.tsx` accepts `?student=<id>` (coach-only; validate
   relationship server-side, show trainee name in header). `TraineesSection` row gains a
   "Generate plan" link → `/training/new?student=<id>`. Plans created by a coach show
   "By your coach" tag where the plan title renders on trainee surfaces (program-card
   meta at minimum).
4. Migration B `2026070713xxxx_nutrition_coach_read.sql`: `ALTER TABLE profiles ADD
   COLUMN nutrition_sharing_enabled boolean NOT NULL DEFAULT false`; replace self-only
   SELECT policies on `meal_logs`, `meal_plans`, `meal_plan_items` with self-or-coach
   policies copying `20260704120000_logs_policies_coach_read.sql:11-24` **plus** an AND
   on the owner's `profiles.nutrition_sharing_enabled = true`.
5. Trainee toggle: profile page "Share nutrition with my coach" switch → server action
   updating the flag (default off). 
6. Coach view: `app/coaching/trainees/[id]/nutrition/page.tsx` (server, coach-guarded,
   relationship-checked): trainee's last-7-days `meal_logs` grouped by day with kcal/
   protein totals vs `meal_plans` targets; empty state explains the trainee must enable
   sharing. Link from the roster row (only when flag on — fetch flag in
   `coaching-hub-data`).

**Anti-patterns:** never trust client-passed student ids without the relationship check
(both in action AND RPC); don't loosen INSERT/UPDATE policies (read-only for coach);
don't rename student_* identifiers (copy says "trainee", code keeps "student").

**Verify:** tsc/eslint/tests; grep policies for `FOR SELECT` only; manual SQL review.

## Phase 6 — QA-ONBOARDING.md

**What:** `QA-ONBOARDING.md` at repo root, compiled from the 8 module READMEs,
`FORMULAS.md`, `plans/features-roadmap.md`, `package.json` scripts. Sections: what the
app is; roles (student/coach/both/admin) and where each lands; module map (route → what
it does → README link); the 6 core user journeys as numbered test walkthroughs
(onboarding→routine, AI plan gen, Today logging + XP, calendar, nutrition logging, coach
hub incl. new features from phases 1-5); gamification rules QA must know (XP table,
streaks/hearts, quotas informational-only — cite FORMULAS.md); how to run locally (pnpm
dev, env vars needed, Supabase migrations); how to report bugs (route, user role, steps,
expected/actual, screenshot); known limitations. Update module READMEs touched by
phases 1-5 in their phases, not here.

**Verify:** links resolve; no stale claims vs current code.

## Final phase — full verification

`pnpm exec tsc --noEmit`, full `pnpm test`, eslint over all changed files, `pnpm build`
if feasible; grep anti-pattern sweep (no `award_session_log_xp` diffs, no XP formula
changes, no coach INSERT policies); update `FORMULAS.md` ONLY if any math moved (none
planned); update module READMEs (onboarding, calendar, training, coaching, nutrition,
profile) for changed behavior.
