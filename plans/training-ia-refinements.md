# Plan — Training IA refinements (Rams audit 25/30 → REFINE)

Five targeted fixes from `DESIGN-IS-2026-07-07/`. Execute in order; each is small and
mostly independent. **Do NOT commit** (the user commits). Verify each: `pnpm exec tsc
--noEmit` · `pnpm exec eslint <changed>` · `pnpm test`. Follow `CLAUDE.md` +
`.claude/skills/coding-style` (SSR-first, tokens only — no raw hex/px, small components).

**Out of scope (do not touch):** the multi-plan data model + migrations, AI prompts,
streak/XP formulas, and the settled 6-item Time-first nav (do NOT re-add a Plan/Training
tab — that would regress principle #10).

**Keep intact (already scored 3 — regression-check after each phase):** running intake
still submits with no race_date; nav stays 6 items; no raw hex/px introduced; no new
gradients; no unbacked badges/labels.

---

## Phase 0 — Ground truth (patterns to copy)

- **Loading skeleton pattern** to clone — `app/coaching/loading.tsx` (whole file): `animate-pulse` + `bg-secondary` rounded blocks inside `mx-auto w-full max-w-… px-4 py-6`. Community variants exist too (`app/community/*/loading.tsx`).
- **Nav active state** — `components/design-system/app-sidebar.tsx`: `keyFromPath(pathname)` currently returns `"calendar"` for `/training` and `/onboarding`; `NavKey` no longer has `plan`/`training` members (removed in the multi-goal work). `routeFor`/`ITEMS` are the 6-item set. `bottom-nav.tsx` owns the `NavKey` type.
- **Collision chip** — `app/calendar/page.tsx:290-294` and the dashboard equivalent (grep `hasHardCollision` / "hard sessions"): copy string "2 hard sessions — consider spacing them."
- **Plan section chrome** — `app/training/components/plan-section.tsx`: per-plan header + week-nav (prev/next `?w_<planId>`) + archive + check-in banner.
- **My-programs entry points** — `app/calendar/page.tsx` ("Manage programs" header button), `app/profile/page.tsx` ("Training" section).
- **Anti-patterns:** do NOT re-introduce a `plan`/`training` NavKey or nav ITEM; do NOT add raw hex/px; do NOT add motion without a `prefers-reduced-motion` guard.

---

## Phase 1 — #4 Nav clarity (the one real defect)

**Problem:** on `/training` (My programs) the **Calendar** tab highlights, because `keyFromPath` maps `/training` → `calendar`. And `/training` has no discoverable entry.

**Do:**
1. `components/design-system/app-sidebar.tsx` — in `keyFromPath`, stop returning `"calendar"` for `/training` and `/onboarding`. Return a value that highlights **no** tab for those routes (e.g. keep the `NavKey` union but return a sentinel that no `ITEMS` entry matches — confirm `aria-current`/active styling then applies to nothing). Do NOT re-add a Plan/Training tab. Verify `/calendar` itself still highlights Calendar.
2. Improve discoverability of "My programs": on `app/dashboard/page.tsx` (Today), add a clear, quiet affordance to reach `/training` when the user has ≥1 active plan (e.g. a "Manage programs" link near the plan block) — mirroring the existing Calendar/Profile entries. Use existing button/link styles + tokens.

**Verify:** tsc/eslint/test; grep that no `ITEMS` entry maps to `/training`; manual reasoning: on `/training` no tab shows `aria-current="page"`. Nav still 6 items.

---

## Phase 2 — #8 Loading skeletons

**Do:** add `loading.tsx` to `app/training/`, `app/dashboard/`, `app/calendar/` by cloning the `app/coaching/loading.tsx` pattern (adjust block shapes to each page's header + card rhythm; keep `max-w-*` matching each page's container). Tokens only (`bg-secondary`, rounded, `animate-pulse`).

**Verify:** tsc/eslint; the three files exist and render static skeletons; `pnpm test` green. Update `app/training/README.md` / `app/dashboard/README.md` / `app/calendar/README.md` to note the loading state if they enumerate states.

---

## Phase 3 — #5 Reduce repeated chrome on stacked plans

**Problem:** with 2 active plans, each `plan-section` repeats full header + week-nav + archive + check-in banner, making chrome visible.

**Do (lightest change that lowers chrome weight — pick one, keep it simple):**
- In `app/training/components/plan-section.tsx`, when more than one plan renders, give sections after the first a lighter treatment: smaller/secondary header, and collapse the week-nav into a more compact control OR keep only one prominent week-nav per section but reduce its visual weight (`variant="ghost"`/smaller size, tokens only). Keep archive + check-in banner reachable but visually quieter.
- Do NOT remove any function (independent per-plan week nav must stay). This is a visual-weight reduction, not a feature change.

**Verify:** tsc/eslint/test; single-plan view is unchanged; two-plan view reads calmer. No raw hex/px.

---

## Phase 4 — #4/#6 Collision chip legibility

**Do:** change the chip copy from "2 hard sessions — consider spacing them." to novice-legible wording, e.g. **"2 intense workouts today — consider spacing them."** Update every occurrence: `app/calendar/page.tsx:290-294`, the dashboard chip, and any README that quotes it (`app/calendar/README.md:30-32`, `app/training/README.md:30-31`). If the count is dynamic, keep it dynamic; only the wording changes. Keep `TriangleAlert` + `flame` tint.

**Verify:** tsc/eslint/test; grep shows no remaining "hard sessions" user-facing copy (READMEs may describe it, but keep them consistent with the new string).

---

## Phase 5 — #9 Motion + weight

**Do:**
1. `app/globals.css` — add a global `@media (prefers-reduced-motion: reduce)` guard that neutralizes `tw-animate-css` transitions/animations (e.g. reduce `animation`/`transition` durations to near-zero for users who opt out). Follow any existing media-query style in the file; tokens/standard CSS only.
2. Measure initial JS on the audited routes: run `pnpm build` and record the route sizes for `/training`, `/dashboard`, `/calendar` from the build output; note them in `DESIGN-IS-2026-07-07/01-evidence.md` (append) to validate the lean-SSR assumption. No code change if sizes are already lean — just record.

**Verify:** tsc/eslint/test; `pnpm build` succeeds; reduced-motion media query present in `globals.css`.

---

## Final verification
- `pnpm exec tsc --noEmit` clean · eslint clean on all changed files · `pnpm test` green.
- Regression checks (the "Keep intact" list): nav still 6 items; no new raw hex/px; running intake still submits without race_date.
- Do NOT commit.
</content>
