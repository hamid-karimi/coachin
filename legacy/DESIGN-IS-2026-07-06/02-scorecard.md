# Scorecard — AddScheduleForm

Scored worst-instance; ties broken downward.

1. **Good design is innovative — 1/3**
   Evidence: conventional day-strip + chip-picker + form (01-evidence › Structural).
   Justification: imitates a standard scheduling form with a minor variation (XP chips),
   not a refreshed pattern.

2. **Good design makes a product useful — 1/3**
   Evidence: one session per submit with a reset (`:42–44`); the "3+ days" goal takes 3+
   loops (01-evidence › Structural).
   Justification: the primary job (compose a week) requires repeated detours, not the
   fewest steps.

3. **Good design is aesthetic — 2/3**
   Evidence: coherent token system; but four identical "Mobility" chips create visual
   repetition (01-evidence › Structural/Visual).
   Justification: the system is consistent (not a 1), but the duplicate chips are a visible
   blemish (not a 3).

4. **Good design makes a product understandable — 1/3**
   Evidence: unexplained `×N` jargon + four indistinguishable "Mobility" chips
   (`sport-chip.tsx:16,:63`).
   Justification: multiple unclear controls and jargon present; a first-timer can't say which
   Mobility to pick or what × means (load-bearing principle).

5. **Good design is unobtrusive — 1/3**
   Evidence: boosted multipliers render volt + bold (`sport-chip.tsx:60`).
   Justification: decoration (the XP number) competes with the actual content (the sport
   choice) at planning time.

6. **Good design is honest — 2/3**
   Evidence: truthful multiplier values, no dark patterns; but "Mobility" label doesn't
   convey differing XP (01-evidence › Copy).
   Justification: one minor label→behavior mismatch, nothing deceptive.

7. **Good design is long-lasting — 2/3**
   Evidence: clean neutral pills, no fad gradients/skeuomorph; multiplier-on-chip is a mild
   gamification trend marker (01-evidence › Visual).
   Justification: largely timeless with one dated marker.

8. **Good design is thorough down to the last detail — 2/3**
   Evidence: disabled/pending/selected/error/success handled; empty (sports = []) missing,
   focus-visible is browser-default (01-evidence › Visual).
   Justification: one genuinely missing state plus a rough one, short of fully considered.

9. **Good design is environmentally friendly — 2/3**
   Evidence: light client component, dark mode honored, no idle motion; no
   `prefers-reduced-motion` guard (01-evidence › Weight).
   Justification: motion isn't gated, and bytes weren't verified — not a clean 3.

10. **Good design is as little design as possible — 1/3**
    Evidence: 3 removable duplicate Mobility chips + removable `×N` + a standalone form
    duplicating the week shown below (01-evidence › Structural).
    Justification: 3–5 removable elements, several duplicated affordances.

**Total: 15 / 30**
