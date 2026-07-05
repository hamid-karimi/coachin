# Adaptive Training System — Phased Implementation Plan

Companion to `plans/adaptive-training-notes.md` (the "why"). Each phase is
self-contained and executable in a fresh context. Builds on branch
`feature/race-plan-any-distance` (any-distance race planner, commit 5c83ded).

---

## Phase 0 — Documentation Discovery (DONE — consolidated findings)

### Allowed APIs and patterns (verified in-repo, cite before use)

**Database (supabase/migrations/):**
- `plan_items` — `id, plan_id, week, day_of_week (0=Sun..6=Sat), item_type, title, details (jsonb), is_completed`; item_type CHECK: `run|strength|stretch|recovery|meal_note` — `supabase/migrations/20260705100000_training_plans.sql:31-45`
- `training_plans` — `id, user_id, race_date, goal_time, status (active|completed|archived), weeks_total, summary, intake (jsonb), raw_ai_response, model`
- RPC `create_training_plan(...)` — atomic archive-prior + insert plan + items pattern to copy for any new transactional RPC — same file, RPC section
- XP idempotency pattern: `award_meal_xp` (+5 XP, 3/day cap, once per log id, reason `'meal_log:{id}'`) — `supabase/migrations/20260705120000_nutrition.sql:100-134`; `achieve_goal` (+200 XP once, row lock) — `20260704160000_goals.sql`
- `logs` (`user_id, date, sport_type_id, status, notes`), `schedules` (`day_of_week`) feed adherence

**Server actions:**
- Action-state pattern: `useActionState` + `MarathonActionState {error?, success?, message?, status?}` + `useActionToast` — `app/marathon/actions.ts:13-20`, `app/marathon/components/intake-wizard.tsx`
- `togglePlanItemAction` — RLS-scoped plan_items update — `app/marathon/actions.ts:235-260`
- XP award in action: fetch profile.xp → update xp + `level = floor(xp/1000)+1` → insert `xp_transactions` — `app/dashboard/actions.ts:28-193` (`logWorkout`)

**AI (lib/ai/):**
- Gemini structured output: `client.models.generateContent({model, contents, config: {responseMimeType: "application/json", responseSchema: {type: Type.OBJECT, ...}}})` — `lib/ai/marathon.ts:161-206`, `lib/ai/gemini.ts` (`analyzeBodyPhotos`, `extractReportMetrics`)
- **Never trust AI output shapes** — validate field-by-field like `validateItems()` — `lib/ai/marathon.ts:59-103`
- `getGeminiClient()` / `getGeminiModel()` — `lib/ai/gemini.ts`

**UI:**
- Plan item rendering (icon+tone by item_type, detail bits, toggle) — `app/marathon/components/plan-item-row.tsx:31-127`
- Adherence strip (done/missed/planned/rest per day, Monday-first) — `app/coaching/components/AdherenceWeekStrip.tsx:1-98`, data: `app/coaching/lib/coaching-hub-data.ts:88-119`
- Design system: `stat-card`, `streak-badge`, `xp-bar`, `confirm-dialog`, `sport-chip` in `components/design-system/`

### Anti-patterns (repo-wide, enforce in every phase)
- ❌ LLM-emitted YouTube URLs (hallucinated video IDs) — emit `video_query` strings, link to YouTube search
- ❌ Regenerating the whole plan on adjustment — only next week's items are ever rewritten
- ❌ Required data entry in session logging — everything beyond "done" is optional
- ❌ New tables without RLS — copy the `user_id = auth.uid()` policy pattern from `body_measurements`
- ❌ Non-idempotent XP — every award needs a unique `xp_transactions.reason` key and an exists-check
- ❌ Inventing Supabase/Gemini API params — only patterns cited above

---

## Phase 1 — Per-session logger (running + strength shapes)

**What to implement:**
1. Migration `supabase/migrations/<ts>_session_logs.sql`:
   - Table `session_logs`: `id uuid pk`, `user_id` FK, `plan_item_id` FK → plan_items, `sport text check (sport in ('run','strength'))`, `rpe int check 1-10 null`, `actual jsonb not null default '{}'`, `note text null (≤500)`, `ai_feedback jsonb null`, `created_at`. Unique on `plan_item_id` (one log per item).
   - RLS: copy owner-only policy pattern from `20260704150000_profiles_body_metrics.sql`.
   - RPC `award_session_log_xp(p_session_log_id)`: +10 XP, idempotent via reason `'session_log:{id}'` — copy the `award_meal_xp` body from `20260705120000_nutrition.sql:100-134`.
2. `actual` JSONB shapes (validate in the action, like `validateItems`):
   - run: `{distance_km?, duration_min?, avg_hr?}`
   - strength: `{exercises?: [{name, sets, reps, weight_kg?}]}`
3. `logSessionAction` in `app/marathon/actions.ts`: parse+validate, insert, call XP RPC, mark the plan_item completed (reuse `togglePlanItemAction` logic inline), revalidate `/marathon`.
4. `SessionLogSheet` client component in `app/marathon/components/`: opened from `plan-item-row.tsx` after completing a `run` or `strength` item ("How did it go?" — skippable). RPE selector, sport-shaped optional fields, note textarea. Follow the `useActionState` + `useActionToast` pattern from `intake-wizard.tsx`.

**Verification:** migration applies (`supabase db reset` locally or `supabase migration up`); `pnpm exec tsc --noEmit`; `pnpm exec eslint app/marathon lib`; log a session twice → second XP award refused (idempotent); RLS: user B cannot select user A's session_logs.

**Anti-pattern guards:** all fields optional except the FK; no XP without exists-check; do not add columns to plan_items.

---

## Phase 2 — AI session feedback

**What to implement:**
1. `lib/ai/session-feedback.ts`: `generateSessionFeedback(item: PlanItem, log: SessionLogInput)` → `{message: string (≤300 chars), flag: "ok"|"caution"|"red"}`.
   - Copy the structured-output pattern from `lib/ai/marathon.ts:161-206`; enum flag via `Type.STRING, enum: [...]` like `moderateBodyImage` in `lib/ai/gemini.ts`.
   - Prompt: planned vs actual comparison, RPE, note. Rules: mention of pain/injury in note → flag ≥ caution; never prescribe medical action, suggest "see a professional" on red.
2. **Deterministic red-flag pre-check BEFORE the AI call** (rules first, AI second): note matches pain keywords (`pain|hurt|injur|schmerz`) or RPE ≥ 9 on an easy item → force flag ≥ caution regardless of AI output.
3. Wire into `logSessionAction`: fire feedback generation after insert, store in `session_logs.ai_feedback`, surface in the toast/sheet. AI failure is non-fatal — log saves without feedback.

**Verification:** tsc/eslint clean; feedback stored as `{message, flag}` after validation (never raw AI JSON); a note containing "knee pain" yields flag ≠ "ok" even if the AI says ok; AI unavailable → session still saves.

**Anti-pattern guards:** validate AI output field-by-field; no plan mutation from session feedback (that's Phase 3's job); non-blocking failure.

---

## Phase 3 — Weekly scorecard + rule-based check-in

**What to implement:**
1. `lib/scorecard.ts` (pure, client-safe like `lib/running.ts`): `computeWeekScorecard(items: PlanItem[], sessionLogs, weekMeals?, weight?)` → `{adherence_pct, planned_km, actual_km, load_delta, flags[]}`. No AI, no I/O — fully unit-testable.
2. Migration `<ts>_weekly_checkins.sql`: table `weekly_checkins` (`id, plan_id FK, week int, scorecard jsonb, decision text check (advance|repeat|deload), summary text, created_at`, unique `(plan_id, week)`, owner RLS via plan join) + RPC `apply_week_adjustment(p_plan_id, p_week, p_items jsonb, p_decision, p_summary)`: transactionally delete + reinsert ONLY the given week's plan_items — copy the transactional insert/validation body from `create_training_plan` in `20260705100000_training_plans.sql`.
3. Decision rules (deterministic, in `lib/scorecard.ts`):
   - adherence < 50% → `repeat` (same week re-emitted, dates shift)
   - two consecutive weeks < 50% → `deload`
   - red flag from any session log this week → `deload` + surface the note
   - otherwise → `advance` (AI may lightly adjust next week)
4. `lib/ai/week-adjustment.ts`: given scorecard + decision + next week's current items, AI rewrites next week's items within the decision (reuse the `PlanItemInput` schema + `validateItems` from `lib/ai/marathon.ts` — import, don't duplicate) + a ≤2-sentence `summary` ("why").
5. Check-in UI: banner on `app/marathon/page.tsx` when the current plan week has ended and no `weekly_checkins` row exists → `/marathon/checkin` page: scorecard (use `stat-card` components), proposed decision + summary, one Confirm button → `applyCheckinAction` calls the RPC. Award +20 XP for completing a check-in (idempotent reason `'weekly_checkin:{id}'`).
6. Coach reuse: extend `getCoachingHubData` (`app/coaching/lib/coaching-hub-data.ts`) to include latest scorecard per trainee with an active plan — render as an "off-track" chip next to the existing adherence strip.

**Verification:** unit-test `computeWeekScorecard` + decision rules with fixture data (missed week → repeat; two missed → deload); RPC only touches the target week's rows (count other weeks' items before/after); check-in twice for same week → unique constraint refuses; tsc/eslint/build clean.

**Anti-pattern guards:** never rewrite more than one week; AI output through `validateItems` only; scorecard math has zero AI; the Confirm button is the only mutation path (no auto-apply).

---

## Phase 4 — Video links + runner support work

**What to implement:**
1. `details.video_query` (string ≤80 chars) on plan items — JSONB, **no migration**:
   - Add to the Gemini `responseSchema` details properties and `validateItems()` in `lib/ai/marathon.ts` (copy the `pace_min_km` string-clamp pattern at `lib/ai/marathon.ts:87-90`).
   - Prompt rule: every `run` (drills), `strength`, `stretch`, `mobility` item gets a concise English form-video search query (e.g. "single leg romanian deadlift form").
2. "Watch how ▶" link in `plan-item-row.tsx`: `https://www.youtube.com/results?search_query=${encodeURIComponent(video_query)}`, `target="_blank" rel="noopener"`, rendered in the detail-bits row.
3. `mobility` item type:
   - Migration `<ts>_mobility_item_type.sql`: extend the `plan_items.item_type` CHECK constraint (drop + re-add with `mobility`) and the same enum inside the `create_training_plan` / `apply_week_adjustment` RPC validation.
   - Add to `ITEM_TYPES` + schema enum in `lib/ai/marathon.ts`, icon/tone map in `plan-item-row.tsx` (pick a lucide icon, e.g. `PersonStanding`, tone like `stretch`).
4. Runner-specific support-work prompt rules in `lib/ai/marathon.ts`:
   - strength items must be runner-specific: hips/glutes/calves/core, single-leg bias — name concrete exercises in titles
   - 1 mobility/yoga item per week (in addition to stretch)
   - experience "new" → bodyweight-first strength

**Verification:** generate a plan → every strength/stretch/mobility item has `video_query`; links open valid YouTube search results; old plans without `video_query` render without a link (no crash); migration keeps existing rows valid; tsc/eslint/build clean.

**Anti-pattern guards:** ❌ NEVER emit or store `youtube.com/watch?v=` URLs from the LLM; `video_query` is optional on read (old plans); constraint migration must not fail on existing data.

---

## Phase 5 — Bodybuilding/hypertrophy intake (sport #2)

**What to implement:**
1. Extend `training_plans.intake` (JSONB, no migration) with `plan_kind: "race" | "hypertrophy"`.
2. `lib/ai/hypertrophy.ts`: mirror the `generateMarathonPlan` structure (same `GeneratedPlan`/`PlanItemInput` types, same `validateItems` — import from `lib/ai/marathon.ts`). Intake: goal (muscle gain / recomp), experience, days/week, equipment (gym / home / bodyweight), injuries, body-photo analysis summary if present (`body_photos.analysis` — `app/profile/body-photos-actions.ts:238-297`), protein target from active `calorie_intake` goal. Items: `strength` with `details.exercises`-style titles + `video_query`, weekly `mobility`, `recovery`, one `meal_note` (protein guidance). Plan length: 8–12 weeks, no race date — use a synthetic end date for `race_date` column or make it nullable via small migration (prefer nullable + rename display).
3. Intake wizard: entry choice step "What are you training for?" (Race → existing flow; Build muscle → new short flow) — extend `app/marathon/components/intake-wizard.tsx` or add a parallel `hypertrophy-wizard.tsx` reusing the step-shell markup.
4. Session logger already supports `strength` shape (Phase 1); scorecard load-progression math (Phase 3) now has real data: extend `computeWeekScorecard` flags with `load_stalled` (same exercise, no weight/rep increase 3 weeks running → suggest deload/variation at check-in).
5. Route naming: keep `/marathon` URLs; add nav label "Training" — full `/plans` rename is out of scope (parked with the concurrent-plans question).

**Verification:** generate a hypertrophy plan end-to-end → items validate, render with dumbbell icons + video links; check-in works on it (decision rules are sport-agnostic); race flow unchanged (regression: generate a race plan); tsc/eslint/build clean.

**Anti-pattern guards:** don't fork `PlanItemInput`/`validateItems` — one shared schema; no new item_types beyond `mobility`; race_date nullability handled in one place.

---

## Phase 6 — Final verification

1. `pnpm exec tsc --noEmit && pnpm exec eslint app lib && pnpm build` — all clean.
2. Grep guards: `grep -rn "youtube.com/watch" lib app` → zero hits in AI/prompt code; `grep -rn "delete.*plan_items" supabase` → only inside week-scoped RPC.
3. Migration chain applies from scratch (`supabase db reset`).
4. Manual loop test: generate race plan → complete + session-log a week (one log with "knee pain" note → red flag) → check-in proposes deload → confirm → next week's items rewritten, other weeks untouched → coach hub shows the scorecard chip.
5. XP audit: each new reason key (`session_log:`, `weekly_checkin:`) appears at most once per entity in `xp_transactions`.

---

## Execution notes

- Each phase = one commit on `feature/race-plan-any-distance` or a fresh branch per phase off it.
- Phases 1→3 are strictly ordered (logger feeds feedback feeds scorecard). Phase 4 is independent and can run anytime. Phase 5 requires 1–4.
- Run `/do plans/adaptive-training-plan.md` to execute phase-by-phase.
