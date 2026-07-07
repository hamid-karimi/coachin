# 01 — Evidence

## Structural
- **Nav reduced:** desktop sidebar went from 8 items to 6, now identical to the mobile bar — `home · calendar · nutrition · community · coaching · profile` (`components/design-system/app-sidebar.tsx:54-67`, `components/design-system/bottom-nav.tsx:25-39`). Two overlapping tabs (`plan`, `training`) removed.
- **Active-state mismatch:** `keyFromPath` maps `/training` AND `/onboarding` to the `calendar` key (`app/sidebar keyFromPath`), so on the "My programs" page the **Calendar** tab is highlighted — location ≠ highlight.
- **"My programs" discoverability:** `/training` has no nav entry; it is reached only via a "Manage programs" button on Calendar and a link on Profile (`app/calendar/page.tsx`, `app/profile/page.tsx`).
- **Repeated chrome:** each active plan renders a full section — title + week-nav (prev/next) + archive + check-in banner — via `app/training/components/plan-section.tsx`. With 2 plans the week-nav affordance appears twice (same purpose, `?w_<planId>` params).
- **Intake step reduction:** the running path no longer forces a race distance/date; a `base` vs `race` segmented control gates the race questions (`app/training/components/intake-wizard.tsx`, `app/training/new/page.tsx`).

## Visual (INFERRED from tokens/source)
- **Token system:** "Volt Ember" — graphite base, one loud color per job (volt lime = act/progress, ember = streak/celebration), the only gradient reserved for streaks (`app/globals.css:1-120`). Dark is the default.
- **Color discipline:** all colors are CSS variables (semantic + brand + tier tokens); components use tokens, not raw hex (repo rule). `--radius: 1rem` single radius base.
- **Collision chip:** soft inline chip, `TriangleAlert` icon (`aria-hidden`) + `flame` tint, copy "2 hard sessions…" (`app/calendar/page.tsx:290-292`, `app/training/README.md:30`). Not a modal.
- **States checklist:**
  - empty — PRESENT (training empty-state CTA; dashboard `!hasActivePlan` branch)
  - loading — MISSING for training/dashboard/calendar; PRESENT for `community/*` and `coaching` (`loading.tsx` files exist only there)
  - error — PRESENT in intake via `useActionState` error surface
  - success — PRESENT (redirect to `/training` on generate)
  - focus — PRESENT (`aria-current`, focus styles on nav)
  - disabled/pending — PRESENT (intake button: `disabled={generating}` → "Generating your plan…", `intake-wizard.tsx:497-503`)

## Copy & Honesty
- Nav labels plain and literal: Today, Calendar, Nutrition, Community, Coaching, Profile.
- "Just start running" / "Train for a race" — labels map 1:1 to behavior.
- Collision chip states only what it is ("2 hard sessions") — no claim of load coordination (matches the deferred-coordinator decision). Honest.
- Coaching off-track badges show real per-discipline adherence %, one per plan (`app/coaching/components/TraineesSection.tsx`) — no last-wins masking.
- Minor jargon risk: "hard sessions" may not be self-explanatory to a novice.
- No dark patterns, no marketing superlatives on the audited surfaces.

## Weight & Friction (ESTIMATED)
- SSR-first; server components by default; only nav is a small `"use client"` leaf. Low client JS on the audited surfaces.
- Dark mode is the default look (honored, not ignored).
- No autoplay video, no idle animation observed; transitions only.
- `tw-animate-css` imported — `prefers-reduced-motion` handling NOT confirmed in source.
- Exact bundle bytes and TTI NOT measured (no build/dev-server driven).

## Measured (post-audit)

Ran `pnpm build` (Next.js 16.1.6, Turbopack) after the refinements. The build
compiles clean and all three audited routes are server-rendered on demand (ƒ):

| Route        | Render mode                 | First Load JS |
| ------------ | --------------------------- | ------------- |
| `/training`  | ƒ (Dynamic, SSR on demand)  | not reported  |
| `/dashboard` | ƒ (Dynamic, SSR on demand)  | not reported  |
| `/calendar`  | ƒ (Dynamic, SSR on demand)  | not reported  |

Note: the Next 16 Turbopack build output lists route render modes but does not
emit the per-route "Size / First Load JS" byte columns that the classic webpack
build printed, so exact byte counts are unavailable from this build. The
lean-SSR assumption holds structurally: these are server components with only
small `"use client"` leaves (nav, wizards, toggles) — no whole-page client
bundles were introduced by the refinements. No code change was needed to keep
the routes lean.
