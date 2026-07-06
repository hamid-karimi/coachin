---
name: coding-style
description: Coachin coding principles and architecture rules. Use whenever writing, refactoring, or reviewing code in this repo — components, pages, hooks, server actions, or tests.
---

# Coachin coding style

Non-negotiable principles for this codebase. When touching old code that violates them, refactor toward them (scoped to what you're already changing — don't rewrite the world in a feature PR).

## 1. Small components

Break big components into small, focused ones. A component that renders several distinct visual blocks (header, list, empty state, banner) should be composed of one component per block. If a file needs scrolling to find the JSX return, it's too big.

- Module-private components: `app/<module>/components/`
- Shared/reusable components: `components/design-system/` (product UI kit) or `components/ui/` (shadcn primitives)

## 2. Reusable components go to the UI kit + Storybook

Anything used (or plausibly usable) by two modules moves to `components/design-system/` with a colocated `*.stories.tsx`. Follow the existing pattern (`stat-card.tsx` + `stat-card.stories.tsx`). Keep design-system components presentational: props in, JSX out, no data fetching, no server actions — that's what makes them story-able.

## 3. Logic lives outside components

Extract logic from components as much as possible:

- Pure logic (calculations, date math, formatting, mapping): util functions in `lib/` (e.g. `lib/dates.ts`, `lib/xp.ts`, `lib/scorecard.ts`) or module-local `app/<module>/lib/`
- Stateful client logic: custom hooks in `components/hooks/` (e.g. `use-action-toast.ts`)
- Components should read as: fetch/receive data → call helpers → render

## 4. Unit tests for the logic

Every non-trivial function in `lib/` (and module `lib/` dirs) gets a colocated `*.test.ts`. Run with `pnpm test` (vitest); `pnpm test:coverage` reports coverage over the logic layer — new logic should not lower it. Components don't need unit tests — pulling logic out of them is exactly what makes testing cheap. Time-dependent helpers use `vi.setSystemTime`. See `lib/dates.test.ts` for the reference style.

## 5. No logic in page files

`page.tsx` files orchestrate only: auth check, data fetching, passing data to components. Any computation beyond trivial destructuring goes to `lib/` helpers or a component. If a page grows conditionals or `.map()`s with business meaning, extract.

## 6. SSR first

Server components by default. `"use client"` only at the interactive leaves (buttons, forms, things using hooks) — never on a whole page or section when only one button inside it is interactive. Mutations go through server actions (`actions.ts`), state-critical multi-step writes (XP, streaks, memberships) through SECURITY DEFINER RPCs with idempotency guards — follow `complete_plan_item` / `award_session_log_xp` as the pattern.

## 7. Hashmaps over if/else and switch

Branch-per-value logic uses lookup objects, not conditional chains. Existing idiom:

```ts
const TYPE_META: Record<string, { icon: Icon; tone: string }> = {
  run: { icon: Footprints, tone: "bg-brand-tint text-brand-ink" },
  strength: { icon: Dumbbell, tone: "bg-secondary text-foreground" },
};
const meta = TYPE_META[item.item_type] ?? TYPE_META.recovery; // explicit fallback
```

If/else stays for genuinely boolean or guard logic — use early returns there, not nesting.

## 8. useReducer over useState sprawl

Three-plus related `useState` calls in one component (wizards, multi-field forms, multi-step flows) become a single `useReducer` with a typed action union. For server data, prefer `useActionState` with server actions (existing pattern) over client state at all.

## 9. Single responsibility, SOLID, DRY

One reason to change per unit: a component renders one thing, a hook manages one concern, a util does one job. If describing a function needs "and", split it. Apply SOLID pragmatically (this is React, not Java): depend on props/interfaces rather than concretions, extend via composition rather than modification, keep modules substitutable. DRY applies to knowledge, not lines — duplicate JSX twice is fine; duplicated business rules (XP math, date math, gating logic) never are: those live in one `lib/` function.

## 10. Clean architecture — dependencies point inward

Layers, outer depends on inner, never the reverse:

1. **Pages** (`app/**/page.tsx`) — orchestration only
2. **Components** (`components/`, `app/<module>/components/`) — presentation
3. **Hooks / server actions** (`components/hooks/`, `actions.ts`) — application flow
4. **Domain logic** (`lib/`, `app/<module>/lib/`) — pure, framework-free, unit-tested
5. **Data access** (`lib/supabase/`, RPCs) — the only place that knows about the database

`lib/` domain functions never import React, Next, or Supabase. Components never call Supabase directly — data arrives via props (server) or actions (mutations).

## 11. Follow the design system

Use `components/design-system/` and `components/ui/` before writing new UI, and design tokens (`app/globals.css`: `--brand`, `--brand-ink`, `--brand-tint`, `--xp`, `--flame`, `--success`, semantic shadcn tokens) before hardcoding values. **No raw hex colors, arbitrary pixel values, or one-off font sizes in components.** If something you need isn't in the system — especially a token — add it to `globals.css` (light + dark) and, for components, ship it with a story. Grow the system; don't bypass it.

## 12. No overengineering

- No abstractions for a single call site; extract on the second use, not the imagined one
- No new dependencies when the platform or an existing dep covers it
- No config/options/generics "for later"
- Match existing patterns before inventing new ones — search the codebase for a precedent first

## Formulas are documented and authoritative

Every formula, constant, and decision rule (XP, levels, streaks, leagues, Riegel/running
math, goal progress, weekly scorecard, nutrition, plan-week dates) lives in `FORMULAS.md`
at the repo root. It is the source of truth and stays in sync with code **both ways**:

- User edits `FORMULAS.md` → update the referenced source file(s) + their `*.test.ts`.
- You change the math in code → update `FORMULAS.md` in the same change.

Never let a magic number drift from its `FORMULAS.md` entry. Before editing anything that
computes a reward, threshold, prediction, or progress bar, read the relevant section first.

## House conventions

- Files: kebab-case. Components: named exports, PascalCase
- Derive types from data (`as const`, `keyof typeof`) instead of parallel enums; no `any`, casts only at validated boundaries
- Icons get `aria-hidden`; icon-only buttons get `aria-label`
- User-facing text is English-only; transient feedback via sonner toasts (`useActionToast`)
- Each `app/<module>/` keeps its `README.md` in sync when behavior changes
- Before every commit and push: `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed files>`, `pnpm test` — all three must pass; never commit on red
