# 03 — Verdict

## REFINE (25/30, no principle below 2)

The restructured training IA has strong bones — a disciplined token system, an honest
and genuinely useful reduction of menu overload and the forced-race flow — and needs
targeted iteration, not a redesign, to close a navigation-clarity gap and a few
thoroughness details.

Verdict rule applied: total ≥ 20 AND no principle scored 0 → REFINE.

## Highest-leverage moves (each tied to a principle + evidence)

1. **#4 Understandable** — Fix the nav active-state mismatch: on `/training` the Calendar tab highlights because `keyFromPath` maps `/training` → `calendar`. Give "My programs"/Training its own resolved active state, and make the entry point discoverable (a clear affordance, not only Calendar/Profile links). Evidence: `keyFromPath` in `components/design-system/app-sidebar.tsx`; entry via `app/calendar/page.tsx` + `app/profile/page.tsx`.

2. **#8 Thorough** — Add `loading.tsx` skeletons for `app/training`, `app/dashboard`, `app/calendar` to match the parity already set by `app/community/*` and `app/coaching`. Evidence: `loading.tsx` exists only under community/* and coaching.

3. **#5 Unobtrusive** — Reduce repeated chrome when two plans stack: the second `plan-section` repeats header + week-nav + archive + check-in banner. Consider a lighter/secondary treatment or a shared week control. Evidence: `app/training/components/plan-section.tsx`.

4. **#4/#6 Understandable+Honest** — Make the collision chip legible to a novice: "2 hard sessions" assumes the reader knows what a "hard session" is. Consider "2 intense workouts today — consider spacing them." Evidence: `app/calendar/page.tsx:290-292`.

5. **#9 Environmentally friendly** — Confirm/add a `prefers-reduced-motion` guard for `tw-animate-css` transitions and measure the initial JS on the audited routes to validate the lean-SSR assumption. Evidence: `tw-animate-css` import in `app/globals.css`; bundle unmeasured.
</content>
