# Plan — Multi-goal training + Time-first IA

Phased, execute **safest-first**. Each phase is self-contained: read the cited files,
copy existing patterns, verify, then stop. **Do not commit** — the user commits.
Verify every phase: `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed files>` · `pnpm test`.
Follow `CLAUDE.md` + `.claude/skills/coding-style/SKILL.md` (SSR-first, server components
default, `"use client"` at leaves, lookup maps, small components, colocated tests).

## Decisions (fixed — do not re-litigate)
- A user can hold **multiple concurrent active plans** — at most **one active per discipline**
  (`race`/running and `hypertrophy`/strength). "Add a goal" adds; it does not wipe the other.
- **Blended-day MVP**: merge items from all active plans into one day; show a **soft** warning
  when 2+ hard sessions land on the same date. No smart cross-plan load coordinator yet.
- **Time-first nav**: daily surfaces = **Today + Calendar** only. Programs become a managed
  library ("My programs") reached from Calendar/Profile — not a top-level daily tab.

---

## Phase 0 — Ground truth (APIs / patterns / anti-patterns)

**Schema (`supabase/migrations/20260705100000_training_plans.sql`)**
- `training_plans(id, user_id, race_date NULL, goal_time, status CHECK active|completed|archived,
  weeks_total 4..24, summary, intake jsonb, raw_ai_response, model, created_at)`.
  `race_date` already nullable (`20260705190000_race_date_nullable.sql`).
- **`plan_kind` is NOT a column** — it lives in `intake.plan_kind` (`'race'` | `'hypertrophy'`).
- `CREATE UNIQUE INDEX training_plans_one_active ON training_plans(user_id) WHERE status='active'`
  — **this is what forbids multiple active plans. Load-bearing; P2 must change it.**
- `plan_items(plan_id, week, day_of_week 0..6, item_type CHECK run|strength|stretch|recovery|meal_note,
  title, details jsonb, is_completed)`.
- RPC `create_training_plan(...)` archives *all* active plans then inserts (lines 111-113).
- RPC `evaluate_user_streak()` (`20260706110000_streak_and_league.sql:101-105`) reads the active
  plan with `LIMIT 1` — silently ignores a second active plan.

**App readers all share the single-plan assumption** (`.eq("status","active").maybeSingle()`):
- `app/training/page.tsx:54` (component still misnamed `MarathonPage`, line 40)
- `app/dashboard/page.tsx:131-135` → `activePlan`, then plan_items 149-151
- `app/calendar/page.tsx:92-96` → plan, then plan_items 119
- `app/training/calendar.ics/route.ts:49-56`
- `app/training/actions.ts` — race gen 228, hypertrophy gen 337, archive 695-720 (`.eq("status","active")`)

**Intake wizard** (`app/training/components/intake-wizard.tsx`): `useActionState` + hidden-field
form; `step` state 1..4; `race_date` is `required` (input at line 257; server re-checks and hard-fails
at `actions.ts:141-143`); `weeks_total` is derived from race date (`actions.ts:144-150`).
`RACE_TARGETS` / `RACE_DISTANCES_KM` / `MarathonIntake` come from `@/lib/ai/...` (see imports 15-24).
Entry chooser lives in `app/training/new/page.tsx` (labels "A race" / "Build muscle").

**Anti-patterns to avoid**
- Do NOT invent a `plan_kind` column reference before P2 adds it — today it is only in `intake`.
- Do NOT keep `.maybeSingle()` on plan reads after P2 (it throws if 2 active rows exist).
- Do NOT add raw hex/px — use tokens from `globals.css` / existing design-system components.
- Do NOT change XP/streak math in code without updating `FORMULAS.md` in the same phase.

---

## Phase 1 — Running intake: beginner-first (UI only, no migration)

**Goal**: running no longer forces a race. Open on **"Just start running"** vs **"Train for a race"**;
race distance/date/goal-time appear only for the race path.

**Files**: `app/training/new/page.tsx`, `app/training/components/intake-wizard.tsx`, `app/training/actions.ts`.

1. `new/page.tsx`: rename the first card label **"A race" → "Running"**, subtitle covering both
   "start from zero" and "train for a race". Keep `kind=race` route (it is the running path).
2. `intake-wizard.tsx`: add a `mode` state `"base" | "race"` with a segmented control at the top of
   step 3 ("Just start running" | "Train for a race"). When `mode==="base"`:
   - hide race distance, race date, goal time;
   - show a simple **program length** selector (e.g. 6/8/12 weeks) → hidden field `base_weeks`;
   - keep experience level + days/week + PBs (all optional).
   Reveal the race fields only when `mode==="race"`. Submit `mode` as a hidden field.
3. `actions.ts` (race action, ~139-206): branch on `mode`.
   - `mode==="race"`: unchanged (race_date required, weeks from race date).
   - `mode==="base"`: **do not require race_date**; `weeks_total = clamp(base_weeks, 4, 24)`;
     `intake.plan_kind="race"`, `race_target="base"` (add `"base"` to the target lookup used for
     the plan title in `app/training/page.tsx:132-140` → "Running plan"), `race_date=null`,
     `goal_time=null`. Pass `p_race_date: null` to the RPC (already supported — hypertrophy does it).
   - Ensure the AI generator (`generateMarathonPlan`) gets a coherent base-building intake; if it
     hard-requires a race, add a base-building branch/prompt (read `lib/ai/` first).

**Verify**: tsc/eslint/test green; a base run with no race date generates a plan and lands on
`/training` titled "Running plan"; race path still works. Update `app/training/README.md`.

---

## Phase 2 — Data model: multiple concurrent active plans

**Goal**: one active plan **per discipline**; "generate" replaces only the same-discipline plan.

**New migration** `supabase/migrations/<ts>_multi_active_plans.sql`:
1. Add column `plan_kind text NOT NULL DEFAULT 'race' CHECK (plan_kind IN ('race','hypertrophy'))`.
2. Backfill: `UPDATE training_plans SET plan_kind = COALESCE(intake->>'plan_kind','race')`.
3. Drop `training_plans_one_active`; create
   `CREATE UNIQUE INDEX training_plans_one_active_per_kind ON training_plans(user_id, plan_kind) WHERE status='active'`.
4. `CREATE OR REPLACE FUNCTION create_training_plan(...)` — add `p_plan_kind text` arg; the archive
   step becomes `WHERE user_id=v_user_id AND status='active' AND plan_kind = p_plan_kind`; set the new
   column on insert. **Keep the old signature dropped/replaced cleanly** (mirror style of the
   existing function; grant execute to authenticated).

**App**: `actions.ts` both gen actions pass `p_plan_kind`; `archivePlanAction` archives by `plan_id`
(it already targets a plan — make it `.eq("id", planId)` instead of `.eq("status","active")` so it
archives one specific plan, 695-720). Add plan_kind column to selects where the title/logic needs it
(prefer the real column over `intake->>`).

**Verify**: tsc/eslint/test; can create a race plan AND a hypertrophy plan and both stay active
(second no longer archives the first). Update `app/training/README.md` + note migration in the phase.

---

## Phase 3 — Blended daily + calendar rendering (+ soft collision warning)

**Goal**: every surface reads **all** active plans, not one.

Replace `.eq("status","active").maybeSingle()` with a plans array (`.eq("status","active")`, order by
`plan_kind`) in: `app/training/page.tsx`, `app/dashboard/page.tsx`, `app/calendar/page.tsx`,
`app/training/calendar.ics/route.ts`. Fetch `plan_items` for all plan ids (`.in("plan_id", ids)`).

- **`/training`**: render one section per active plan (tabbed or stacked), each with its own week nav.
  De-`MarathonPage` naming happens in P4; here just handle N plans without crashing.
- **`/dashboard` + `/calendar`**: merge today's/this-week's items across plans into the day view,
  grouped by date. Add a small helper in `lib/` (framework-free, unit-tested) e.g.
  `collisionsForDay(items): boolean` = 2+ items with `item_type in ('run','strength')` (hard sessions)
  on the same date. Render a soft chip/banner ("2 hard sessions today — consider spacing them").
- `calendar.ics`: emit events for all active plans.

**Verify**: tsc/eslint/test incl. new `collisionsForDay` test; a user with two plans sees both on
Today and Calendar and gets the warning on a colliding day. Update calendar + dashboard READMEs.

---

## Phase 4 — Time-first nav + "My programs" manager

**Goal**: collapse Plan/Training/Calendar; unify mobile + desktop; kill marathon-specific naming.

- `components/design-system/bottom-nav.tsx` + `app-sidebar.tsx`: single IA. Daily items = Today,
  Calendar, Meals/Nutrition, Community, (Coaching), Profile. **Remove standalone "Plan" and
  "Training"** as daily tabs (the `plan`→`/onboarding` and `training` NavKeys). Keep NavKey type in
  sync across both files and `routeFor`/`keyFromPath`. Update `bottom-nav.stories.tsx`.
- **"My programs" manager**: a screen (e.g. `/training` becomes the manager, or add `/training` list)
  listing active plans with add/swap/archive + "view week-by-week", reached from Calendar and Profile.
  The routine editor (`/onboarding`) is linked from here, not from a top-level nav item.
- Rename `MarathonPage` → `TrainingPage` (`app/training/page.tsx:40`) and generalize marathon-specific
  copy/identifiers to discipline-neutral ("program"/"training").

**Verify**: tsc/eslint/test + Storybook renders; nav identical on mobile and desktop; no dead
NavKeys. Update `app/training/README.md` and any nav docs.

---

## Phase 5 — FORMULAS: streak/XP across multiple plans

**Decision to document in `FORMULAS.md` §2 (streak)**: streak stays **day-based and global**, not
per-plan. A day is **"required"** if a routine schedule OR **any active plan** has a non-`meal_note`
item that date; a day is **"trained"** if any `logs` row is `completed` that date. Therefore nailing
runs but skipping lifts **keeps the streak** (the day was trained). Only a fully missed required day
spends a heart.

- Update `evaluate_user_streak()` (new migration): replace the single `LIMIT 1` plan lookup
  (`20260706110000_streak_and_league.sql:101-144`) with an `EXISTS` over **all** active plans:
  `EXISTS (SELECT 1 FROM plan_items pi JOIN training_plans tp ON tp.id=pi.plan_id
   WHERE tp.user_id=v_user_id AND tp.status='active' AND <plan_week matches> AND pi.day_of_week=v_dow
   AND pi.item_type<>'meal_note')`. Compute plan_week per plan from its own `created_at`.
- Mirror any pure logic in `lib/streak.ts` and update its `*.test.ts`.
- XP: confirm plan-item completion rewards (`20260706100000_plan_item_completion_rewards.sql`) are
  per-item and already work per-plan — document that they sum across plans; adjust only if double-counting.

**Verify**: tsc/eslint/test; `lib/streak.ts` tests cover the "runs done, lifts skipped → streak safe"
case. `FORMULAS.md` and code agree.

---

## Final verification
- `pnpm exec tsc --noEmit` clean · `pnpm exec eslint` on all changed files clean · `pnpm test` green.
- grep: no remaining `.eq("status", "active").maybeSingle()` on `training_plans`; no `MarathonPage`.
- `FORMULAS.md`, `app/training/README.md`, `app/dashboard/README.md`, `app/calendar/README.md` updated.
- Do NOT commit.
</content>
</invoke>
