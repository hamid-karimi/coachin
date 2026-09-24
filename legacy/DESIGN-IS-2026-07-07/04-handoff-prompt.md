# 04 — /make-plan Handoff

````
/make-plan Refine the Coachin training IA (Time-first nav, "My programs" manager, beginner-first intake, blended day/calendar, coaching badges) based on a Dieter Rams audit (total 25/30).

Verdict paragraph (quoted from the audit):
> The restructured training IA has strong bones — a disciplined token system, an honest and genuinely useful reduction of menu overload and the forced-race flow — and needs targeted iteration, not a redesign, to close a navigation-clarity gap and a few thoroughness details.

Keep (already strong, do NOT touch in this pass):
- #2 Useful (3) — Evidence: race no longer forced; nav detours removed; "My programs" consolidates management. Regression check: confirm the running intake still submits with no race_date and the nav still has 6 items.
- #3 Aesthetic (3) — Evidence: single "Volt Ember" token system in app/globals.css. Regression check: grep changed files for raw hex/px — there should be none; all colors via tokens.
- #6 Honest (3) — Evidence: collision chip claims only "2 hard sessions"; coaching badges show real per-discipline adherence. Regression check: no new badge/label without a backing value.
- #7 Long-lasting (3) — Evidence: graphite + one accent, sole gradient reserved for streaks. Regression check: no new gradients or trend styling introduced.
- #10 As little design as possible (3) — Evidence: net-removed two nav tabs + the forced-race step. Regression check: nav item count stays at 6; no new duplicated affordances.

Fix in priority order (top moves from the audit, verbatim):
1. #4 Understandable: Fix the nav active-state mismatch — on /training the Calendar tab highlights because keyFromPath maps /training → calendar. Give the "My programs"/Training page its own resolved active state, and make its entry point discoverable (a clear affordance, not only Calendar/Profile links). Evidence: keyFromPath in components/design-system/app-sidebar.tsx; entry via app/calendar/page.tsx + app/profile/page.tsx.
2. #8 Thorough: Add loading.tsx skeletons for app/training, app/dashboard, app/calendar to match the parity already set by app/community/* and app/coaching. Evidence: loading.tsx exists only under community/* and coaching.
3. #5 Unobtrusive: Reduce repeated chrome when two plans stack — the second plan-section repeats header + week-nav + archive + check-in banner. Consider a lighter/secondary treatment or a shared week control. Evidence: app/training/components/plan-section.tsx.
4. #4/#6 Understandable+Honest: Make the collision chip legible to a novice — "2 hard sessions" assumes the reader knows the term. Consider "2 intense workouts today — consider spacing them." Evidence: app/calendar/page.tsx:290-292.
5. #9 Environmentally friendly: Confirm/add a prefers-reduced-motion guard for tw-animate-css transitions and measure initial JS on the audited routes. Evidence: tw-animate-css import in app/globals.css; bundle unmeasured.

Out of scope for this refine pass: the multi-plan data model + migrations (already shipped), the AI plan-generation prompts, the streak/XP formulas, and any structural nav redesign (the 6-item Time-first IA stays).

Deliverables for the plan:
- Per-fix: target files, exact change, verification step (tsc/eslint/test + a manual check where relevant)
- Token/spec changes consolidated in one place
- Regression checklist for every "Keep" item above

Anti-patterns to guard against (specific to REFINE):
- Adding new abstractions where a direct change suffices
- Restyling areas that already scored 3
- Scope creep into structural redesign (the Time-first 6-item nav is settled)
- Letting fixes mutate principles outside the priority list
````
</content>
