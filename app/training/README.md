# Training Module

Generates and displays AI training programs (running and hypertrophy), handles
weekly check-ins, plan-item completion, and session logging.

## "My programs" manager

`/training` is the **program manager**, not a daily tab. In the Time-first IA
the daily surfaces are **Today + Calendar** only (see `components/design-system/
bottom-nav.tsx` + `app-sidebar.tsx`), so `/training` is reached from:

- **Calendar** — a "Manage programs" button in the header.
- **Profile** — a "Training" section linking to "My programs" and the routine
  editor (`/onboarding`).

The manager lists every active program (one per discipline) with an **"Add a
goal"** affordance (`/training/new`), an **"Edit routine"** link (`/onboarding`),
per-program **archive** (`ArchivePlanButton` in each `PlanSection`), and an
"Add to calendar" `.ics` export. The empty state is a single "Add a goal" CTA.

## Structure

- `page.tsx` (default export `TrainingPage`): loads **all** active
  `training_plans` (one per discipline) + their `plan_items`, derives each
  plan's title, and renders one `PlanSection` per active plan — each with its
  own week navigation (per-plan `?w_<planId>` query param, week anchored to that
  plan's `created_at`). Orchestration only.
- `loading.tsx`: static skeleton (server component; `animate-pulse` +
  `bg-secondary` blocks) shown while the page's server data resolves, matching
  the `max-w-3xl` container, header, and a plan section's week-nav + day rhythm.
- `components/plan-section.tsx`: presentational section for a single plan —
  title, summary, per-plan week nav, and the day-by-day items. When plans
  stack, sections after the first render with a `secondary` prop that lightens
  the chrome (smaller header, a top divider, and ghost week-nav buttons) while
  keeping every control — independent week nav, archive, check-in banner —
  fully functional. Shows a soft
  "2 intense workouts today" chip on any day where 2+ `run`/`strength` items land
  (via `hasHardCollision` from `lib/training-day.ts`).
- `new/page.tsx`: entry chooser ("Running" vs "Build muscle") and, per `kind`,
  renders the running intake (`IntakeWizard`) or `HypertrophyWizard`.
- `actions.ts`: server actions — plan generation (running + hypertrophy),
  activity-file parsing, plan-item toggle, session logging, check-in apply,
  archive.
- `components/intake-wizard.tsx`: the running intake wizard (client leaf).
- `components/hypertrophy-wizard.tsx`: the strength intake wizard (client leaf).
- `checkin/`: weekly check-in flow.

## Running intake — base vs race

The running path (`new/page.tsx?kind=race`) opens on a choice at step 3 of the
wizard between two modes, submitted as a hidden `mode` field:

- **`base` — "Just start running"** (default): no race. The wizard hides race
  distance, race date, and goal time, and shows a **program length** selector
  (`base_weeks`, options from `BASE_WEEK_OPTIONS` = 6 / 8 / 12 weeks). Experience
  level, days/week, and PBs stay optional.
- **`race` — "Train for a race"**: the full race flow — race distance, a
  **required** race date, and an optional goal time.

### Server handling (`generatePlanAction`)

The action branches on `mode`:

- **`race`**: race distance/date required; `weeks_total` is derived from the
  race date (`floor(weeks until) `, min 4, max 24); `first_time_at_distance`
  from the athlete's longest PB; `p_race_date` and `p_goal_time` passed through.
- **`base`**: race date is **not** required. `weeks_total = clampBaseWeeks(base_weeks)`
  (`lib/running.ts`, clamps to 4..24, default 8). The intake is stored with
  `plan_kind: "race"`, `race_target: "base"`, `race_distance_km: 0`,
  `race_date: null`, `goal_time: null`, and `p_race_date: null` is passed to the
  `create_training_plan` RPC (already supported — hypertrophy does the same).

Both modes call `generateMarathonPlan` (`lib/ai/marathon.ts`), which uses a
**base-building prompt branch** when `race_target === "base"`: easy aerobic runs
(run/walk for new runners), one gently-growing longer run, strength + mobility,
progressive with a stepback every 4th week, and **no taper or goal-pace work**.

The `MarathonIntake` type (`lib/ai/marathon.ts`) accepts `race_date: string | null`
and a `race_target` of `"base"`; `planTitleFor` (`lib/plan-title.ts`) maps
`race_target: "base"` to the plan title **"Running plan"** and `plan_kind`
`hypertrophy` to **"Muscle building plan"**.
