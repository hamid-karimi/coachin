# /make-plan handoff — REDESIGN

Copy-paste the fenced prompt below into a new session to build the redesign plan.

````
/make-plan Redesign the onboarding "add a sport session" experience (app/onboarding — AddScheduleForm.tsx + WeekAgenda.tsx). Current design failed a Dieter Rams audit at 15/30 with critical gaps in principles #2 (useful), #4 (understandable), #5 (unobtrusive), and #10 (as little design as possible).

Verdict paragraph (quoted from the audit):
> The form scores 15/30 — below the 20 threshold — so this is a REDESIGN: the transactional "add one row, reset, repeat" structure fights the actual job (compose a week), and unexplained XP jargon plus four indistinguishable "Mobility" chips undercut understandability, so the fix is structural, not cosmetic.

Why redesign and not refine: total below 20, and the two lowest, load-bearing scores — #2 useful (1) and #4 understandable (1) — are caused by the structure (a separate transactional form that duplicates the week and leaks reward-time XP math into planning), which styling can't repair.

Preserve from current design:
- Brand tokens and design-system primitives — `SportIcon` and the `Sport` type/icon map (components/design-system/sport-chip.tsx:1-21, 76-88); globals.css tokens (brand, brand-tint, brand-ink, secondary, border, muted-foreground).
- The `WeekAgenda` vertical day-by-day layout (app/onboarding/components/WeekAgenda.tsx) — it is the surface the redesign builds INTO.
- Server actions `addScheduleItem` / `deleteScheduleItem` (app/onboarding/actions.ts) and the ConfirmDialog delete flow already wired in WeekAgenda.
- The recent readability + confirm-delete work (camera icon, spelled-out macros, confirm-on-delete) — do not regress it.

Discard:
- The standalone AddScheduleForm as a separate surface above the week. Evidence: AddScheduleForm.tsx:42-44 (resets per add) + page.tsx renders it above WeekAgenda. Caused failure on #2 and #10.
- XP multipliers on planning chips. Evidence: sport-chip.tsx:56-65, passed at AddScheduleForm.tsx:117. Caused failure on #4 and #5.
- Four duplicate "Mobility" chips. Evidence: sportFromName collapses them (sport-chip.tsx:16). Caused failure on #4 and #10 — needs a data dedup, not just UI.

Top moves from the audit (verbatim):
1. #2 useful / #10: Delete the standalone form; compose the week in-place — each WeekAgenda day row gets a "+" that opens an inline sport picker. Evidence: AddScheduleForm.tsx:42-44; page.tsx order.
2. #4 understandable / #5 unobtrusive: Remove ×N multipliers from planning chips (icon + name only); XP multipliers live at log-time/dashboard. Evidence: sport-chip.tsx:56-65; AddScheduleForm.tsx:117.
3. #4 / #10: Dedup "Mobility" to one canonical sport_types row — repoint schedules.sport_type_id + logs.sport_type_id, delete extras (separate data/migration workstream). Evidence: sport-chip.tsx:16, screenshot.
4. #2 useful: Multi-day selection — pick one sport, tap the days it applies to, add once. Evidence: one-per-submit loop AddScheduleForm.tsx:39-45.
5. #8 thorough / #5: Demote time + "repeat until" to a "more options" affordance; add an explicit focus-visible ring and an empty-sport-list state. Evidence: fields front-and-center :126-149; no empty guard :99.

Redesign principles in priority order:
1. Useful (#2) — building a 3+ day week takes as few taps as possible; multi-day-per-sport in one action; no reset-and-repeat.
2. Understandable (#4) — every control names itself; no unexplained jargon; one Mobility, distinctly named if variants are truly needed.
3. Unobtrusive (#5) — the week (content) is the figure; the picker chrome recedes; XP math is absent at planning time.
4. As little design as possible (#10) — one surface, not two; no duplicated affordances.

Deliverables for the plan:
- New information architecture (compose-in-agenda, not derived from the old form-above-list split).
- Primary flow, low-fi + labeled, compared side-by-side to the current form: "tap day + → pick sport → (optional multi-day / more options) → done", mobile-first.
- Token/spec decisions (picker as inline expander vs bottom sheet on mobile), states checklist (empty sport list, loading, error, success, focus-visible, disabled).
- The Mobility dedup as its own phase: a Supabase migration that repoints schedules/logs to the canonical Mobility sport_types id and deletes the duplicates, with a safety check for rows referencing the deleted ids.
- Migration path for users mid-onboarding (the change is UI-only for them; the sport_types dedup must not orphan existing schedule/log rows) and cutover criteria (old AddScheduleForm removed once inline add reaches parity: day, sport, optional time, optional repeat-until).

Constraints: Next.js App Router, follow .claude/skills/coding-style (small components, logic in lib/ + hooks with unit tests, SSR-first, design-system tokens only). Verify with tsc + eslint + pnpm test before done. Work on a new branch from develop.

Anti-patterns to guard against:
- Porting the old day-strip + chip-row structure under new styling (that's a refine, not a redesign).
- Keeping both the old form and the inline add behind a flag indefinitely.
- Doing the UI dedup of Mobility without the underlying sport_types data dedup (the chips will reappear).
- Reintroducing XP multipliers into the planning chips "for power users".
````
