# Onboarding "add a sport session" — Redesign Plan

Source: Dieter Rams audit `DESIGN-IS-2026-07-06/` — verdict **REDESIGN (15/30)**.
Goal: compose the training week **in place** (no standalone form), fewer taps, mobile-first,
no XP jargon at planning time, one canonical "Mobility".

**Branch:** new branch from `develop` (e.g. `feat/onboarding-inline-add-session`).
**Coding style:** `.claude/skills/coding-style/SKILL.md` — small components, logic in `lib/` +
hooks with colocated `*.test.ts`, design-system tokens only, SSR-first. Verify with
`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm test` before every commit.

Phases are independently executable in fresh contexts. Do them in order; Phase 1 (data) and
Phases 2–4 (UI) are decoupled enough to land as separate PRs.

---

## Phase 0 — Discovery (facts; already gathered)

Read these before touching code. Cited so later phases don't re-derive them.

**Current UI**
- `app/onboarding/components/AddScheduleForm.tsx` — standalone form: 7-day strip, sport chips
  with `×N` multipliers, time, repeat-until, Add. Resets per submit (`:39–45`). **To be deleted.**
- `app/onboarding/components/WeekAgenda.tsx` — vertical day-by-day agenda (the surface we build
  INTO). Renders `RoutineSessionCard` (editable, delete via `ConfirmDialog`) + `PlanSessionCard`
  (read-only AI plan). `WEEK_DAYS` from `lib/week-days.ts`.
- `app/onboarding/page.tsx` — client component; `useLoadData()` returns `{ sports, schedules,
  planItems }`; renders `AddScheduleForm` then `WeekAgenda`; delete wired via `useActionState`
  + `deletePending`.
- `app/onboarding/hooks/useLoadData.ts`, `useRefreshSchedules.ts` — client data load + refresh
  after add/delete.

**Server + data**
- `app/onboarding/actions.ts`:
  - `getSportTypes()` → `select * from sport_types`.
  - `getUserSchedules()` → `select *, sport_types(name)`.
  - `addScheduleItem(prevState, formData)` reads `sport_type_id`, `day_of_week`, `time`,
    `ends_on`; inserts ONE `schedules` row. `deleteScheduleItem` reads `scheduleId`.
- `schedules` columns: `id, user_id, day_of_week (0=Sun..6=Sat), sport_type_id (bigint FK),
  time, created_at, starts_on (date, nullable), ends_on (date, nullable)`
  (`supabase/migrations/20260212000000_initial_schema.sql`,
  `…/20260705210000_schedules_active_window.sql`).
- `sport_types`: `id bigint GENERATED, name text, xp_multiplier real`. **Admin-seeded at runtime
  — NOT seeded in any migration.** The four "Mobility" rows are hand-entered dupes.
- `logs.sport_type_id bigint` FK → `sport_types` (`initial_schema.sql`). Routine XP is computed
  at log time from `sport_types.xp_multiplier` (`app/dashboard/actions.ts:70,80`).
- `lib/sports.ts` `sportFromName()` maps any "Mobility"-named row → `"mobility"` — why all four
  chips render identically.

**Design-system**
- `components/design-system/sport-chip.tsx`: `SportChip` hides the `×` when `multiplier` is
  `undefined` (`:56`). `SportIcon` = icon tile. `Sport` union + icon map (`:6–17`). SportChip is
  used ONLY by the old form + its story — dropping multipliers = don't pass the prop.
- Sheet/dialog precedent for a picker surface: `app/onboarding/components/PlanSessionSheet.tsx`.
- `ConfirmDialog` at `components/design-system/confirm-dialog.tsx` (wraps `onConfirm` in a
  transition — reuse pattern for any `useActionState` dispatch).

**Decisions locked by the brainstorm**
- Compose in-agenda (day-first entry), multi-day-per-sport, no `×N`, one Mobility, time +
  repeat-until behind "More options".

---

## Phase 1 — Data: dedup "Mobility" to one canonical sport_type (migration)

**Independent workstream.** Applied manually by the user (as with prior migrations).

**What to implement** — new migration
`supabase/migrations/<ts>_dedup_mobility_sport_types.sql` that, in one transaction:
1. Picks the **canonical** Mobility row: `MIN(id)` among `WHERE name ILIKE 'mobility'`.
2. Repoints references: `UPDATE public.schedules SET sport_type_id = <canonical> WHERE
   sport_type_id IN (<dupes>)`; same for `public.logs`.
3. Deletes the non-canonical Mobility rows.
4. Sets the canonical row's `xp_multiplier` deliberately — **recommend `1.0`** (neutral; avoids a
   "2× mobility" that inflates future routine XP). Note in a comment that this affects future
   `logWorkout` XP only (past `xp_transactions` are immutable).

Write it defensively with a PL/pgSQL block that resolves ids by name at runtime (ids are
environment-specific — do **not** hardcode). Guard: if 0 or 1 Mobility rows exist, no-op.

```sql
DO $$
DECLARE v_canonical bigint;
BEGIN
  SELECT MIN(id) INTO v_canonical FROM public.sport_types WHERE name ILIKE 'mobility';
  IF v_canonical IS NULL THEN RETURN; END IF;
  UPDATE public.schedules SET sport_type_id = v_canonical
    WHERE sport_type_id IN (SELECT id FROM public.sport_types
                            WHERE name ILIKE 'mobility' AND id <> v_canonical);
  UPDATE public.logs SET sport_type_id = v_canonical
    WHERE sport_type_id IN (SELECT id FROM public.sport_types
                            WHERE name ILIKE 'mobility' AND id <> v_canonical);
  DELETE FROM public.sport_types WHERE name ILIKE 'mobility' AND id <> v_canonical;
  UPDATE public.sport_types SET name = 'Mobility', xp_multiplier = 1.0 WHERE id = v_canonical;
END $$;
```

**Verification**
- After apply: `SELECT count(*) FROM sport_types WHERE name ILIKE 'mobility'` = 1.
- No orphans: `SELECT count(*) FROM schedules s LEFT JOIN sport_types t ON t.id = s.sport_type_id
  WHERE t.id IS NULL` = 0; same query for `logs`.
- The onboarding sport list shows a single Mobility chip.

**Anti-pattern guards**
- Do not hardcode sport_type ids (they differ per environment).
- Do not delete before repointing (FK violation / orphaned logs).
- Do not skip this and only hide dupes in the UI — they'd reappear from the raw `sport_types` list.

---

## Phase 2 — Server action + testable logic (multi-day add)

**What to implement**
1. Pure helper `lib/schedule-inserts.ts` → `buildScheduleInserts({ userId, sportTypeId, days,
   time, endsOn })` returning one insert-row object per day (`{ user_id, sport_type_id,
   day_of_week, time, ends_on }`). Dedupe `days`, drop invalid (0–6), normalize empty
   time/endsOn to `null`. **Colocated `lib/schedule-inserts.test.ts`** covering: multi-day fan-out,
   dedupe, invalid-day drop, null normalization, empty-days → `[]`.
2. New server action `addScheduleSessions(prevState, formData)` in
   `app/onboarding/actions.ts`: reads `sport_type_id`, `day_of_week` (repeated / CSV), optional
   `time`, optional `ends_on`; validates like `addScheduleItem`; builds rows via the helper;
   inserts them in one `.insert([...])`; `revalidatePath("/onboarding")`; returns
   `{ success, message: "N sessions added" }`. Model validation + error copy on the existing
   `addScheduleItem` (`app/onboarding/actions.ts`).

**Verification** — `pnpm test` (new helper tests green); `tsc` clean; a manual call inserts N rows.

**Anti-pattern guards**
- Keep the fan-out logic in the pure helper (testable), not inside the action.
- Reuse the existing validation/error shape — don't invent a new `NutritionActionState`-style type.

---

## Phase 3 — UI: inline `DaySportPicker` composed into `WeekAgenda`

**Interaction model (locked):** day-first. Each day row gets an **"+ Add session"** affordance.
Tapping it opens an **inline expander beneath that day** (one code path, all screen sizes — matches
the vertical agenda; simpler than a modal; the sheet in `PlanSessionSheet` is the fallback if a
day list ever gets long). The expander pre-scopes to that day and contains:
- **Sport grid** — `SportIcon` + name only (NO multiplier; do not pass `multiplier` to any chip).
  Tokens only.
- **"Also on" multi-day row** — the other weekday short-labels as toggle chips (the tapped day is
  pre-selected), so one sport → several days → Add once.
- **"More options" disclosure** (collapsed by default) — `time` and `repeat until` (`ends_on`).
- **Add** button (brand) + Cancel; disabled until a sport is picked.

**What to implement**
1. `app/onboarding/components/DaySportPicker.tsx` (client) — presentational + local state via a
   small `components/hooks`/local `useAddSession` hook (selected sport, selected days set,
   more-options open). Submits through `addScheduleSessions` using the `ConfirmDialog`
   transition-safe dispatch pattern (or a `<form action={…}>`). Include an **empty state**: if
   `sports.length === 0`, show a short "No sports available yet" message instead of a blank grid.
   Add explicit **focus-visible** rings on the sport + day toggles (design-system focus token —
   don't rely on browser default).
2. Integrate into `WeekAgenda.tsx`: add the "+ Add session" control to each day row header;
   render `DaySportPicker` inline when that day is the open one (track `openAddDay` state); pass
   `sports`, `deleteAction` etc. through. Keep `RoutineSessionCard` + `PlanSessionCard` untouched.
3. Thread `sports` + the new `addScheduleSessions` action from `page.tsx` → `WeekAgenda`.

Provide a `DaySportPicker.stories.tsx` (design-system rule: reusable UI gets a story) covering:
default, sport selected + multi-day, more-options open, empty-sport-list.

**Verification**
- Build a 3-day week: pick a day's +, choose Running, toggle two more days, Add → three routine
  cards appear across three days from a single action.
- No `×` anywhere in the picker; `grep -rn "multiplier" app/onboarding` returns nothing in the
  new components.
- Keyboard: Tab reaches +, sport toggles, day toggles, Add — each with a visible focus ring.
- `pnpm exec tsc --noEmit` · `pnpm exec eslint app/onboarding` · `pnpm test` green.

**Anti-pattern guards**
- Don't port the old horizontal day-strip + chip-row into the picker (that's a refine). The day
  strip is replaced by day-first entry + the "also on" toggles.
- Don't pass `multiplier` to `SportChip`/`SportIcon` anywhere in planning.
- Don't render the picker as a second always-visible surface above the agenda — it opens inline,
  per day, on demand.

---

## Phase 4 — Cutover + verification

**What to implement**
1. Delete `app/onboarding/components/AddScheduleForm.tsx` and its export from
   `app/onboarding/components/index.ts`; remove its usage + `addAction`/`addState` wiring from
   `page.tsx` (replace with the new action threaded to `WeekAgenda`). Remove now-dead
   `addScheduleItem` only if nothing else uses it (`grep`); otherwise leave it.
2. Update `app/onboarding/README.md`: the flow is now compose-in-agenda (day-first + → inline
   picker → multi-day add), no standalone form; note the Mobility dedup migration.
3. Parity checklist (old form → new picker): day ✅, sport ✅, optional time ✅, optional
   repeat-until ✅, plus multi-day (new). Only retire the old form once parity holds.
4. Full gate: `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm test`.
   Grep guards: no `AddScheduleForm` references remain; no `multiplier` in `app/onboarding`
   planning components; `sport_types WHERE name ILIKE 'mobility'` count = 1 (after Phase 1 applied).

**Anti-pattern guards**
- Don't keep both the old form and the inline add behind a flag — remove the old form in this phase.
- Don't reintroduce `×N` "for power users".
- Don't merge Phase 3 UI without Phase 1 applied in the target DB, or four Mobility rows reappear
  in the picker grid.

---

## Cutover criteria (done = all true)
- Old `AddScheduleForm` deleted; onboarding adds sessions only via the inline day picker.
- Building a 3+ day week is possible from a single sport selection (multi-day).
- No XP multiplier appears at planning time.
- Exactly one "Mobility" sport row; no orphaned `schedules`/`logs`.
- tsc + eslint + tests green; onboarding README + a `DaySportPicker` story updated.
