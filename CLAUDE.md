# Coachin

Next.js (App Router) + Supabase training/gamification app. pnpm, Tailwind, shadcn/ui, Storybook, vitest.

## Coding style — always applies

Full rules in `.claude/skills/coding-style/SKILL.md`. Read it before writing or refactoring code. The short version:

1. Small components; break big ones apart (`app/<module>/components/`)
2. Reusable UI → `components/design-system/` with a `*.stories.tsx`
3. Logic out of components → `lib/` helpers or `components/hooks/`
4. Unit-test that logic (`pnpm test`, colocated `*.test.ts`)
5. Zero logic in `page.tsx` — orchestration only
6. SSR first: server components by default, `"use client"` at leaves only, mutations via server actions / idempotent RPCs
7. Lookup maps over if/else chains and switches
8. `useReducer` (typed action union) once related `useState`s hit ~3
9. Single responsibility everywhere; SOLID pragmatically; DRY for business rules, not JSX
10. Clean architecture: pages → components → hooks/actions → `lib/` domain logic → data access; dependencies point inward, `lib/` stays framework-free
11. Follow the design system: existing components + tokens from `globals.css`; no raw hex/px — add missing tokens to the system instead
12. No overengineering: no single-use abstractions, no new deps without need, follow existing precedent

## Go rewrite — branch workflow

The Go backend rewrite (`plans/go-backend-rewrite/`) lives on its own long-lived
branch. `main` and `develop` stay as they are (Next.js + Supabase on Vercel) and
receive **no** rewrite work.

- **Mother branch**: `feat/backend-rewrite-with-go` — treat it as the rewrite's main.
- Every rewrite change goes on a short-lived branch cut from it and lands through a
  pull request whose **base is `feat/backend-rewrite-with-go`** — never `main` or
  `develop`.
- Never open rewrite PRs against, or push rewrite commits to, `main` / `develop`.

## Verify before every commit and push

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed files>` · `pnpm test` — never commit on red.

## Formulas — `FORMULAS.md` is authoritative

All XP, streak, league, running, goal, scorecard, and date math is documented in
[`FORMULAS.md`](FORMULAS.md). It is the **source of truth**: when the user edits a formula
or constant there, update the referenced code to match (and its `*.test.ts`). When you
change any of that math in code, update `FORMULAS.md` in the same change so the two never
disagree. Read it before touching XP, streaks, tiers, goals, plans, or scorecards.

## Module docs

Each `app/<module>/README.md` documents behavior — update it when you change the module.

## QA doc — keep it current

[`QA-ONBOARDING.md`](QA-ONBOARDING.md) is how QA learns and tests the system.
**Every time a feature is built or behavior changes, update it in the same
change**: extend the relevant test journey (or add one), the module map, and
the "gamification rules" / "known intentional behaviors" lists if they moved.
Treat it like FORMULAS.md — code and doc must never disagree.

## Work log — session continuity

[`WORKLOG.md`](WORKLOG.md) is the running journal that survives usage-limit
pauses, context resets, and nights of sleep.

- **At the start of every session**: read the top entry first to restore
  context — what was in flight, on which branch, and what's next.
- **After every committed chunk of work** (and always before a session might
  end — long task, limits approaching): append an entry at the TOP with:
  date · branch · what was done (commits) · decisions made · exact next steps
  (including anything NOT yet done, e.g. unpushed branches or unapplied
  migrations).
- Keep entries short and skimmable; newest first. This file is for the human
  and the next Claude session equally — write it so either can resume cold.
