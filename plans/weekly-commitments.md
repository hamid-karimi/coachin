# Plan — Weekly commitments v1 (anchors + quotas + AI-aware generation)

Redesign `/onboarding` into a **"My week" commitments editor** and introduce **weekly
quotas**. Execute phases in order. **Do NOT commit** (the user commits). Verify each
phase: `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm test`. Follow
`CLAUDE.md` + `.claude/skills/coding-style` (SSR-first, tokens only — no raw hex/px,
small components, lookup maps, colocated tests for lib logic).

## Model (decided — do not re-litigate)
- **Anchor** = fixed recurring session: sport + day + optional time + optional repeat
  window. Already exists = the `schedules` table. Anchors create "required days" for
  the daily streak (already true in `evaluate_user_streak`).
- **Quota** = weekly target: sport × N sessions/week, no fixed day. NEW concept.
  Fulfilled automatically by completed `logs` rows of that sport within the Mon–Sun
  week. Quotas must NOT create required days — no streak/heart effect, no new XP in
  v1 (progress display only).
- **AI plans** are generated *aware of anchors*: prompts receive the user's fixed
  sessions as constraints (avoid double-booking, avoid hard sessions on/right before
  intense anchor days). Prompt-only — no scheduling engine.
- "Main sport" profile field: **deferred** — derive from logs later when something
  consumes it.

## Ground truth (verified)
- `schedules(id, user_id, day_of_week smallint NOT NULL 0-6, sport_type_id bigint FK,
  time, starts_on, ends_on)` — `supabase/migrations/20260212000000_initial_schema.sql:108`.
- `logs(id, user_id, date, sport_type_id bigint FK, status public.log_status, notes)` —
  same file line 94. Ad-hoc logging UI lives on Today (`app/dashboard/actions.ts`).
- `sport_types(id, name, xp_multiplier, …)` — same file line 31; fetched by
  `getSportTypes()` in `app/onboarding/actions.ts:26`.
- Onboarding actions (`app/onboarding/actions.ts`): `getSportTypes`, `getUserSchedules`,
  `getCurrentPlanWeekItems`, `addScheduleItem`, `deleteScheduleItem`, `completeOnboarding`.
- Onboarding UI (`app/onboarding/components/`): `AddScheduleForm.tsx` (day strip + sport
  chips + time + repeat-until), `WeekAgenda.tsx` (day rows; routine cards + read-only AI
  plan cards + `PlanSessionSheet`), `PageHeader`, `CompleteOnboardingButton`.
- Week window convention: Monday-first (`mondayOf` in `lib/dates`), `toLocalYMD`.
- Streak RPC reads `schedules` by `day_of_week` only — a separate quotas table cannot
  disturb it.
- RLS/migration style to copy: `supabase/migrations/20260706130000_meal_plans.sql`
  (table + CHECK + unique + self-only policies).

## Rams constraints (baked in from the audit — apply everywhere)
- States: empty / loading / error / success / focus / disabled for every new surface.
- Labels honest and novice-legible; no jargon ("Weekly target", "Fixed session").
- Tokens only; reuse existing chips/cards; no new deps; remove more than you add where
  possible (the XP multiplier moves OFF the sport picker chips — it answers a question
  nobody asked at that moment; keep `SportChip` multiplier prop for other callsites).

---

## Phase 1 — Data: `weekly_quotas` + progress helper + FORMULAS

1. **Migration** `supabase/migrations/<ts after 20260706150000>_weekly_quotas.sql`:
   `weekly_quotas(id uuid pk, user_id uuid NOT NULL FK profiles ON DELETE CASCADE,
   sport_type_id bigint NOT NULL FK sport_types, sessions_per_week int NOT NULL CHECK
   (BETWEEN 1 AND 14), created_at timestamptz default now(),
   UNIQUE (user_id, sport_type_id))`. RLS self-only (copy meal_plans policy style:
   select/insert/update/delete for authenticated, `user_id = auth.uid()`).
2. **Server actions** in `app/onboarding/actions.ts` (same style as addScheduleItem):
   `getWeeklyQuotas()`, `addWeeklyQuota(prev, formData)` (validate sport id + 1..14;
   upsert on the unique pair), `deleteWeeklyQuota(prev, formData)`. Revalidate
   `/onboarding`, `/dashboard`, `/calendar`.
3. **Progress helper** `lib/weekly-quotas.ts` (framework-free, colocated test):
   `quotaProgress(quotas: {sport_type_id, sessions_per_week}[], logs: {sport_type_id,
   date, status}[]): {sport_type_id, target, done}[]` — `done` = count of DISTINCT
   dates with a completed log of that sport (two runs same day = 1, mirrors streak's
   day-based counting; document this in the JSDoc). Cap `done` display at target is a
   UI concern, not the helper's.
4. **FORMULAS.md**: new short section — quotas are informational weekly targets;
   fulfilled by completed logs (distinct days per sport, Mon–Sun local week); NO effect
   on streaks/hearts/XP in v1.

Verify: tsc/eslint/test incl. new `lib/weekly-quotas.test.ts` (cases: empty, partial,
met, over-target, two-logs-same-day, planned-status ignored, other-sport ignored).

## Phase 2 — "My week" editor redesign (`/onboarding`)

Reframe the page from "onboarding wizard" to the commitments editor (first-run
onboarding still uses it; keep `completeOnboarding` flow intact).

1. **Page copy**: title "My week" (keep an onboarding-context subtitle when arriving
   from first-run if that state exists; otherwise one honest line: "Fixed sessions and
   weekly targets — your recurring commitments. AI plan sessions appear alongside.").
2. **Two add flows** replacing the single `AddScheduleForm` block, as two small
   components in `app/onboarding/components/`:
   - `AddFixedSessionForm` — the existing anchor form, cleaned: day strip, sport chips
     WITHOUT xp multiplier (drop the `multiplier` prop at this callsite; keep real
     `label` names from the earlier fix), optional time, optional repeat-until.
   - `AddWeeklyTargetForm` — sport chips + a sessions/week stepper (1–7 typical, allow
     to 14) + Add. Posts to `addWeeklyQuota`.
   Present them as two clearly labeled sections or a simple two-option segmented
   control ("Fixed session" | "Weekly target") — pick the lighter one; no new deps.
3. **Quota list**: chips/rows above the agenda — "Running · 2× per week" with current
   progress ("1/2 this week") and a delete. Progress via `quotaProgress` fed by this
   week's completed logs (fetch in the server page, pass down).
4. **WeekAgenda** stays for anchors + AI items (keep the overflow/min-w-0 and today-rail
   fixes). Legend copy updated: "edit it in Training" (the old text says "Plan").
5. Update `app/onboarding/README.md`.

Verify: tsc/eslint/test; both add flows work against a dev DB if available (note if not).

## Phase 3 — Surface quota progress on Today + Calendar

1. **Today (`app/dashboard/page.tsx`)**: a quiet "This week" line/chips near the plan
   block — e.g. `Running 1/2 · Strength 0/2` — only when quotas exist. Reuse
   `quotaProgress`; fetch quotas + this week's logs (the page already fetches logs-ish
   data; extend, don't duplicate).
2. **Calendar (`app/calendar/page.tsx`)**: same chips in the week header row, computed
   for the VIEWED week (works for past weeks too — logs are date-scoped).
3. A tiny shared presentational chip component if (and only if) Today + Calendar would
   otherwise duplicate JSX — `components/design-system/quota-chip.tsx` + story, tokens
   only (met = brand-tint, unmet = secondary).
4. Update dashboard + calendar READMEs.

Verify: tsc/eslint/test.

## Phase 4 — AI generation respects anchors

1. In `app/training/actions.ts` (BOTH race and hypertrophy actions): fetch the user's
   `schedules` (with sport_types name + time) and pass a compact
   `anchors: {day_of_week, time, sport}[]` into the intake.
2. In `lib/ai/marathon.ts` (and the hypertrophy prompt in `lib/ai/hypertrophy.ts`):
   when anchors exist, add a constraints block to the prompt — the user's fixed
   sessions with day/time/sport; instruct: do not schedule plan sessions that
   double-book those slots; avoid HARD sessions (long/interval runs, heavy strength)
   on the same day as an intense anchor; prefer complementary placement. Type the
   intake extension minimally (like the `race_target: "base"` extension).
3. Persisted `intake` will naturally include anchors (it's the same object) — fine.
4. Update `app/training/README.md` (generation is anchor-aware, prompt-level only).

Verify: tsc/eslint/test; generate a plan against a dev DB if available and confirm the
prompt includes the block (log or unit-test the prompt-builder function if one exists).

## Phase 5 — Final sweep

- Full tsc/eslint/tests; grep no `multiplier=` left on the onboarding sport picker;
  states checklist on new surfaces; READMEs + FORMULAS consistent.
- Do NOT commit.
</content>
