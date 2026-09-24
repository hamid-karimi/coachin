# 00 — Scope

**Audited:** the restructured Coachin training information architecture on branch
`feat/multi-goal-training-ia` (static source audit — no running instance; visual
facts are INFERRED from source + tokens).

**Surfaces:**
1. Time-first navigation — `components/design-system/bottom-nav.tsx`, `components/design-system/app-sidebar.tsx`
2. "My programs" manager — `app/training/page.tsx`, `app/training/components/plan-section.tsx`
3. Beginner-first running intake — `app/training/new/page.tsx`, `app/training/components/intake-wizard.tsx`
4. Blended day/calendar + collision chip — `app/dashboard/page.tsx`, `app/calendar/page.tsx`, `lib/training-day.ts`
5. Coaching off-track badges — `app/coaching/components/TraineesSection.tsx`

**Primary user:** an athlete who may train for more than one goal at once (e.g. running + strength).
**Primary task:** see what to train today and manage one or more training programs, without being forced into a race goal.

**Constraints:** Next.js App Router (SSR-first), Tailwind + shadcn/ui, the "Volt Ember" token system in `app/globals.css` (dark-default; one accent per job; no raw hex in components).

**Method note:** static repo, no dev server driven. Weight/friction estimated from architecture (server components) rather than measured bytes.
</content>
