# 02 — Scorecard

1. **Good design is innovative — 2/3**
   Evidence: navigate-by-time + blended multi-discipline day with a soft collision chip (01 §Structural, §Visual).
   Justification: a clear improvement on the single-plan fitness-app norm, shipped with restraint — but a refresh, not a category-new pattern.

2. **Good design is useful — 3/3**
   Evidence: race no longer forced; nav detours removed; "My programs" consolidates management (01 §Structural).
   Justification: the primary tasks (train today, manage plans, start running from zero) complete in fewer steps with no decoy actions.

3. **Good design is aesthetic — 3/3**
   Evidence: single "Volt Ember" token system, one accent per job, one radius, no raw hex (01 §Visual).
   Justification: spacing/type/color obey one visible system with no orphan styles on the audited surfaces.

4. **Good design is understandable — 2/3**
   Evidence: on `/training` the **Calendar** tab lights up (`keyFromPath` → `calendar`), and `/training` has no nav label — reached only via Calendar/Profile (01 §Structural).
   Justification: labels are plain, but the active-state mismatch plus the hidden "My programs" entry make one primary location non-obvious — needs explanation.

5. **Good design is unobtrusive — 2/3**
   Evidence: with 2 active plans, each `plan-section` carries its own header + week-nav + archive + check-in banner (01 §Structural).
   Justification: chrome stays quiet for one plan but becomes visibly repeated with two — chrome present, not fully receding.

6. **Good design is honest — 3/3**
   Evidence: collision chip claims only "2 hard sessions"; coaching badges show real per-discipline adherence; intake labels map 1:1 (01 §Copy & Honesty).
   Justification: every label/badge maps to actual behavior; no inflation, no dark patterns.

7. **Good design is long-lasting — 3/3**
   Evidence: graphite + one accent, the sole gradient reserved for streaks, no skeuomorphism (01 §Visual).
   Justification: restrained visual language with no dated trend markers; reads as current in 3 years.

8. **Good design is thorough down to the last detail — 2/3**
   Evidence: empty/error/success/focus/pending all present, but no `loading.tsx` skeleton for training/dashboard/calendar while community/coaching have them (01 §Visual states).
   Justification: one state (loading) is missing on the primary audited surfaces — an inconsistency, not a hole.

9. **Good design is environmentally friendly — 2/3**
   Evidence: SSR-first, dark-default, no idle animation; but bundle unmeasured and `prefers-reduced-motion` unconfirmed (01 §Weight & Friction).
   Justification: architecture is lean and motion is minimal, but the <100KB + reduced-motion bar for a 3 can't be confirmed — score the lower.

10. **Good design is as little design as possible — 3/3**
    Evidence: the change net-removed two nav tabs, collapsed overlapping concepts, and cut the forced-race step (01 §Structural).
    Justification: each remaining nav item and per-plan control earns its place; the second plan's week-nav is required for independent navigation.

**Total: 25 / 30**
</content>
