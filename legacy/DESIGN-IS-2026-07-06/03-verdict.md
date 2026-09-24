# Verdict — REDESIGN (15/30)

**The form scores 15/30 — below the 20 threshold — so this is a REDESIGN: the transactional
"add one row, reset, repeat" structure fights the actual job (compose a week), and unexplained
XP jargon plus four indistinguishable "Mobility" chips undercut understandability, so the fix
is structural, not cosmetic.**

Why redesign and not refine: the total is below 20, and the two lowest, most load-bearing
scores — #2 useful (1) and #4 understandable (1) — are caused by the *structure* (a separate
transactional form that duplicates the week and leaks reward-time XP math into planning), which
a styling pass can't repair.

## Highest-leverage moves (spine of the plan)

1. **#2 useful / #10 as little design** — Delete the standalone form; compose the week
   in-place. Each `WeekAgenda` day row gets a `+` that opens an inline sport picker, so you
   build where you see the result. Evidence: reset-per-add `AddScheduleForm.tsx:42–44`; form
   duplicates the week rendered by `WeekAgenda` (`page.tsx` order).
2. **#4 understandable / #5 unobtrusive** — Remove `×N` multipliers from the planning chips
   (icon + name only); XP multipliers move to log-time / dashboard. Evidence:
   `sport-chip.tsx:56–65`, passed at `AddScheduleForm.tsx:117`.
3. **#4 understandable / #10** — Dedup "Mobility" to one canonical `sport_types` row
   (separate data/migration workstream: repoint `schedules.sport_type_id` +
   `logs.sport_type_id`, delete extras). Evidence: four identical chips collapse via
   `sportFromName` — `sport-chip.tsx:16`, screenshot.
4. **#2 useful** — Fold in multi-day selection: pick one sport, tap the days it applies to,
   add once. Evidence: current one-per-submit loop `AddScheduleForm.tsx:39–45`.
5. **#8 thorough / #5** — Demote time + "repeat until" to a "more options" affordance; add an
   explicit focus-visible ring and an empty-sport-list state. Evidence: fields front-and-center
   `:126–149`; no empty guard `:99`.
