# Training Module

Generates and displays AI training programs (running and hypertrophy), handles
weekly check-ins, plan-item completion, and session logging.

## "My programs" manager

`/training` is the **program manager** where plans are created, managed, and
archived. It is a **top-level `Training` tab** in the nav (see
`components/design-system/bottom-nav.tsx` + `app-sidebar.tsx`) — plan creation
is a primary feature, so it sits alongside Today and Calendar rather than behind
them. Both `/training` and the routine editor (`/onboarding`) highlight the
Training tab. Secondary entry points also exist on **Calendar** ("Manage
programs" header button) and **Profile** ("Training" section).

The manager is deliberately light: it lists every active program (one per
discipline) as a **compact card** with a **"New plan"** affordance
(`/training/new`), an **"Edit routine"** link (`/onboarding`), per-program
**archive** (`ArchivePlanButton`), and an "Add to calendar" `.ics` export. The
empty state is a single "Create a plan" CTA. The **day-by-day schedule is not
shown here** — that is Calendar's job (blended across all active plans); each
card links to it. Marking a session done + logging it happens on **Today**
(`/dashboard`), gated to the session's day.

## Structure

- `page.tsx` (default export `TrainingPage`): loads **all** active
  `training_plans` (one per discipline), derives each plan's title + current
  week + check-in-due state, and renders one `ProgramCard` per plan.
  Orchestration only — no `plan_items` fetch (the schedule lives in Calendar).
- `loading.tsx`: static skeleton (server component; `animate-pulse` +
  `bg-secondary` blocks) shown while the page's server data resolves, matching
  the `max-w-3xl` container, header, and card rhythm.
- `components/program-card.tsx`: compact per-program summary — title, meta
  (week X of Y, days-to-race, goal), a "Week N review ready" check-in CTA when
  due (links to `/training/checkin?plan=<id>`), archive, and a "View sessions
  in Calendar" link. No week-by-week browsing.
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

## Anchor-aware generation

Both generation actions (`generatePlanAction` and `generateHypertrophyPlanAction`)
fetch the user's currently-active fixed weekly sessions (the `schedules` table,
joined with sport names) and pass them into the intake as
`anchors: { day_of_week, time, sport }[]` (best-effort — a failed fetch yields
`[]` and never blocks generation; the anchors persist inside the saved plan's
`intake` jsonb like every other intake field).

When anchors exist, both prompt builders append a constraints block
(`anchorsPromptBlock` in `lib/ai/anchors.ts`): don't schedule plan sessions
that conflict with those slots, and treat them as training load — no HARD
sessions (long runs, intervals, heavy strength) on intense anchor days; put
key sessions on free days. This is **prompt-level only** — there is no
scheduling engine, and the response schema/validation is unchanged. The
week-agenda collision chip remains the post-hoc guard when the model still
double-books a day.
