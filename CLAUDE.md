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

## Verify before every commit and push

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed files>` · `pnpm test` — never commit on red.

## Module docs

Each `app/<module>/README.md` documents behavior — update it when you change the module.
