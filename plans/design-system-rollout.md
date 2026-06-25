# Plan — Roll out the Emerald design system across CoachIn

Rebuild the real app pages (auth, onboarding, dashboard, community) on top of the
new shadcn primitives (`components/ui/*`) and CoachIn design-system components
(`components/design-system/*`), wired to the **existing, unchanged** Supabase
server actions.

Each phase is self-contained and can be executed in a fresh chat context.

---

## ✅ Base branch — resolved

The design system was merged into `develop` (PR #17, commit `b06d5e5`), so
`components/ui/*`, `components/design-system/*`, and `lib/utils.ts` exist there.

**Base the feature branch on `develop`:**

```bash
git checkout develop && git pull
git checkout -b feat/design-system-rollout
```

Open the PR back against `develop`.

---

## Phase 0 — Allowed APIs + shared adapters (ALWAYS FIRST)

### 0a. Allowed APIs — design system component contracts

These are the ONLY props that exist. Do not invent props. Read the source before use.

**Primitives — `components/ui/`**
- `Button` ([button.tsx](../components/ui/button.tsx)) — `variant`: `brand`(default)|`default`|`destructive`|`outline`|`secondary`|`ghost`|`link`; `size`: `default`|`sm`|`lg`|`icon`; `asChild`.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` ([card.tsx](../components/ui/card.tsx)).
- `Badge` ([badge.tsx](../components/ui/badge.tsx)) — `variant`: `default`|`brand`|`xp`|`flame`|`secondary`|`outline`|`destructive`.
- `Input` ([input.tsx](../components/ui/input.tsx)), `Label` ([label.tsx](../components/ui/label.tsx)).
- `Avatar`, `AvatarImage`, `AvatarFallback` ([avatar.tsx](../components/ui/avatar.tsx)).
- `Progress` ([progress.tsx](../components/ui/progress.tsx)) — `value` (0–100), `indicatorClassName`.
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` ([tabs.tsx](../components/ui/tabs.tsx)).

**CoachIn components — `components/design-system/`**
- `XpBar` ([xp-bar.tsx](../components/design-system/xp-bar.tsx)) — `level:number`, `currentXp:number`, `nextLevelXp:number`.
- `StatCard` ([stat-card.tsx](../components/design-system/stat-card.tsx)) — `label`, `value:ReactNode`, `icon?`, `accent?`: `default`|`brand`|`xp`|`flame`.
- `StreakBadge` ([streak-badge.tsx](../components/design-system/streak-badge.tsx)) — `days:number`.
- `TierBadge` ([tier-badge.tsx](../components/design-system/tier-badge.tsx)) — `tier`: `bronze`|`silver`|`gold`|`platinum`.
- `SportChip` / `SportIcon` + `sportMeta()` ([sport-chip.tsx](../components/design-system/sport-chip.tsx)) — `sport`: `running`|`strength`|`swimming`|`cycling`|`mobility`.
- `LeaderboardRow` ([leaderboard-row.tsx](../components/design-system/leaderboard-row.tsx)) — `rank`, `name`, `initials`, `xp`, `tier?`, `avatarUrl?`, `highlight?`.
- `WorkoutCard` ([workout-card.tsx](../components/design-system/workout-card.tsx)) — `sport`, `time?`, `xp:number`, `status?`: `pending`|`done`, `onLog?`. **Presentational only** — no server-action wiring inside.

Design tokens (use these classes, not raw `slate-*`/`blue-*`): `bg-brand text-brand-foreground`,
`bg-brand-tint text-brand-ink`, `bg-xp-tint text-xp-ink`, `bg-flame-tint text-flame-ink`,
`bg-card`, `bg-secondary`, `text-muted-foreground`, `border-border`. Defined in
[app/globals.css](../app/globals.css).

### 0b. Allowed APIs — server actions & data (DO NOT MODIFY signatures)

- Auth: `loginAction(prev, formData)` → `LoginState` ([login/actions.ts](../app/auth/login/actions.ts)); `registerAction(prev, formData)` → `RegisterState` with optional `redirect` ([register/actions.ts](../app/auth/register/actions.ts)). Both consumed via `useActionState` + `useActionToast`.
- Toast contract: `useActionToast(state)` reads `{ error?, success?, message?, status? }` ([use-action-toast.ts](../components/hooks/use-action-toast.ts)).
- Dashboard: `logWorkout(prev, formData)` (form field `sport_type_id`, `notes`; returns `{ success?, error?, earnedXp? }`), `logoutAction()` ([dashboard/actions.ts](../app/dashboard/actions.ts)). Page server-fetches `profile`, `schedules`+`sport_types`, today's `logs` ([dashboard/page.tsx](../app/dashboard/page.tsx)). `ScheduleItem` type exported from the page.
- Onboarding: `getSportTypes()`, `getUserSchedules()`, `addScheduleItem(prev, formData)`, `deleteScheduleItem(prev, formData)`, `completeOnboarding()` ([onboarding/actions.ts](../app/onboarding/actions.ts)). Hooks in `app/onboarding/hooks/*`.
- Community: `getCommunityData(...)` ([community-data.ts](../app/community/lib/community-data.ts)) + actions `generateCoachInviteCodeAction`, `connectCoachByCodeAction`, `joinClubByInviteAction`, `createClubAction`, `setPrimaryClubAction`, `leaveClubAction`, `assignCoachWeeklyPlanAction`, `followUserAction`, `unfollowUserAction` ([community/actions.ts](../app/community/actions.ts)); discovery in [discover.ts](../app/community/lib/discover.ts). Types in [community/types.ts](../app/community/types.ts).

### 0c. Build shared adapters (the bridge between DB data and DS components)

Create `lib/sports.ts`:
- `sportFromName(name?: string | null): Sport` — lowercase/trim and match `sport_types.name`
  to the `Sport` union; map common names (run→`running`, strength/gym/weights→`strength`,
  swim→`swimming`, bike/cycle→`cycling`, yoga/mobility/stretch→`mobility`); **fallback** to
  `mobility` (the generic Activity icon) for unknown names so it never throws.

Create `lib/xp.ts`:
- `levelProgress(xp: number): { currentXp: number; nextLevelXp: number }` — mirror the
  existing dashboard math (`currentXp = xp % 1000`, `nextLevelXp = 1000`) so behavior is
  unchanged. Keep it in one place so XpBar and any future use agree.

**Verification:** `pnpm exec tsc --noEmit` clean; `sportFromName("Trail Run")` and
`sportFromName(undefined)` both return valid `Sport` values (unit-check via a tiny `node -e`).

**Anti-pattern guards:** do NOT add a sport to the `Sport` union without also adding its
icon+tint in `sportMeta`. Do NOT edit any `actions.ts` signature. Do NOT hardcode hex
colors in pages — use token classes from 0a.

---

## Phase 1 — Authenticated app shell (sidebar + bottom nav)

**What to implement** — new shared chrome for logged-in routes.
- `components/design-system/app-sidebar.tsx` (desktop, `hidden md:flex`) — brand mark +
  nav items (Home/Plan/Community/Profile) built from primitives, active state via
  `usePathname()`, styled like the desktop mock (sidebar + `bg-brand-tint text-brand-ink`
  active item).
- Wrap `dashboard`, `community`, `onboarding` in a shared shell: add an
  `app/(app)/layout.tsx` route group **or** a `components/design-system/app-shell.tsx`
  wrapper that renders `AppSidebar` (desktop) + page content + `BottomNav` (mobile, fixed
  to bottom). Reuse existing `BottomNav` ([bottom-nav.tsx](../components/design-system/bottom-nav.tsx))
  — convert its `onNavigate` usage to `next/link` via an `asChild`-style wrapper or wrap
  buttons in `Link` at the call site.

**Doc refs:** desktop sidebar + mobile bottom-nav shape — see the mock in the prior chat and
`BottomNav` source. Active-state pattern: `usePathname()` from `next/navigation`.

**Verification:** navigating between the three routes shows the correct active item on both
breakpoints; `pnpm exec tsc --noEmit` clean.

**Anti-pattern guards:** do not use `position: fixed` sidebars that overlap content without
padding; keep the shell server-component-friendly (mark only the interactive nav `"use client"`).

---

## Phase 2 — Auth pages (login + register)

**What to implement** — restyle, reuse logic verbatim.
- `app/auth/components/auth-shell.tsx` — replace `AuthContainer` with the split layout:
  emerald brand panel (`bg-brand text-brand-foreground`, feature list) on `md:` + form
  column. Keep a single-column centered card on mobile.
- Rebuild [login/page.tsx](../app/auth/login/page.tsx): keep `useActionState(loginAction)` +
  `useActionToast(state)`; swap markup to `Label`+`Input`+`Button variant="brand"`; add the
  segmented Log in / Sign up control using `Tabs` or two `Link`s; keep the `sr-only` error
  region for a11y.
- Rebuild register page similarly (fields: fullName, email, password, confirmPassword). On
  `state.redirect` push via `useRouter().push(state.redirect)` (register returns
  `redirect: "/dashboard"`).
- Replace the custom spinner `SubmitButton` with a `Button` that reads `useFormStatus()`
  `pending` (keep the component name/location or inline it).

**Doc refs:** auth split-panel mock (prior chat); `LoginState`/`RegisterState` shapes in 0b.

**Verification:** login with bad email shows the existing validation toast; successful
register with email-confirm-off redirects to `/dashboard`; dark mode readable.

**Anti-pattern guards:** do not change action validation logic; do not remove `name="email"`
/`name="password"`/`name="confirmPassword"`/`name="fullName"` form fields (actions read them
by name).

---

## Phase 3 — Onboarding (weekly schedule builder)

**What to implement** — restyle the builder, keep data flow.
- Rebuild [onboarding/page.tsx](../app/onboarding/page.tsx) + `AddScheduleForm`,
  `ScheduleGrid`, `CompleteOnboardingButton`, `PageHeader`/`PageContainer` using DS:
  day chips (Mon–Sun toggle), `SportChip`/`SportIcon` driven by `getSportTypes()` mapped
  through `sportFromName`, `Input type="time"`, `Button variant="brand"` for "Add session",
  and a 7-column week grid (desktop) / grouped list (mobile) for added sessions with a
  remove (`ti`/lucide `X`) calling `deleteScheduleItem`.
- Keep the existing hooks (`useLoadData`, `useRefreshSchedules`, `useRedirect`) and wire
  `addScheduleItem` / `deleteScheduleItem` / `completeOnboarding` unchanged.

**Doc refs:** onboarding mock (prior chat); action signatures in 0b; hooks in `app/onboarding/hooks/`.

**Verification:** add a session → it appears in the week grid; remove it → it disappears;
"Continue" runs `completeOnboarding` and redirects to dashboard.

**Anti-pattern guards:** preserve `day_of_week` 0–6 semantics; preserve the form field names
the actions read.

---

## Phase 4 — Dashboard

**What to implement** — compose DS primitives; wrap the action.
- Rebuild [dashboard/page.tsx](../app/dashboard/page.tsx) layout: header greeting +
  `XpBar` (fed via `levelProgress(profile.xp)` + `profile.level`), a `StatCard` row
  (Streak`accent="flame"` / Level / Weekly XP / Rank), and "Today's plan".
- Create `app/dashboard/components/workout-card.tsx` **v2** that wraps the **presentational**
  DS `WorkoutCard` is NOT enough (DS one has no form). Instead build a data-aware card here:
  compose `SportIcon` (via `sportFromName(item.sport_types?.name)`) + sport name + time +
  `xp_multiplier` badge + a `<form action={action}>` with hidden `sport_type_id`, optional
  `notes` `Input`, and a `Button variant="brand"` submit driven by `useActionState(logWorkout)`
  + `useFormStatus`. Keep the confetti effect and `useActionToast` exactly as in the current
  card ([current workout-card.tsx](../app/dashboard/components/workout-card.tsx)).
- Empty state ("Rest day") and completed state styled with `bg-brand-tint text-brand-ink`.

**Doc refs:** dashboard mock (prior chat); current card for confetti+action wiring (0b);
`XpBar`/`StatCard`/`SportIcon` contracts (0a).

**Verification:** logging a workout fires confetti once, shows the +XP toast, flips the card
to done; `force-dynamic` data still loads; rest day renders empty state.

**Anti-pattern guards:** keep the `sport_type_id` hidden input and `notes` field names; do not
move the server fetch out of the page (it stays a server component).

---

## Phase 5 — Community (largest; restyle in place)

**What to implement** — restyle each section; reuse `getCommunityData` + actions.
- `CommunityLayout` + `TabNavigation` → DS `Tabs`/`TabsList`/`TabsTrigger` (Leaderboards /
  Coaching / Clubs / Friends), preserving the existing `useTransition` tab-loading UX.
- `LeaderboardSection` → board sub-pills (Global / My Club / My Circle) + `LeaderboardRow`
  list with `TierBadge` (map `profiles.league_tier`→`Tier`) and `highlight` for the current
  user; fall back to profile XP when weekly aggregation is empty (existing behavior).
- Coaching: `CoachesSection`, `StudentsSection`, `GenerateInviteCodeForm`,
  `AddCoachByCodeForm`, `AssignPlanButton` → `Card` + `Button` + `Badge` + `Avatar`,
  wired to `generateCoachInviteCodeAction` / `connectCoachByCodeAction` /
  `assignCoachWeeklyPlanAction`.
- Clubs: `ClubMembershipSection` (create/join/leave/set-primary) → `Card`+`Button`, wired to
  `createClubAction`/`joinClubByInviteAction`/`leaveClubAction`/`setPrimaryClubAction`.
- Friends: `FriendsSection` + `FollowToggleButton` → search `Input`, result rows with
  `Avatar`+`Button`, wired to `followUserAction`/`unfollowUserAction` and discovery
  (`fetchDiscoverProfiles`).

**Doc refs:** community mock (prior chat); [community/page.tsx](../app/community/page.tsx),
`getCommunityData`, [types.ts](../app/community/types.ts), action signatures (0b). Read each
component file before editing.

**Verification:** each tab loads its data; follow/unfollow toggles update; create/join club
shows correct toast; coach invite code generates; dark mode readable. Update
`community-layout.stories.tsx` if its props changed.

**Anti-pattern guards:** keep tab-aware data conditioning (don't fetch all boards at once);
keep RPC-status-aware toasts (`created`/`already_connected`/`reactivated`); reuse the
English-only message conventions.

---

## Phase 6 — Verification & cleanup (FINAL)

1. `pnpm exec tsc --noEmit` → clean.
2. `pnpm run lint` → clean.
3. `pnpm exec next build` → succeeds (or `pnpm dev` smoke if build needs env).
4. `pnpm exec storybook build` → still passes (no regressions to stories).
5. Grep guards — should return **nothing** in `app/**`:
   - `grep -rE "slate-[0-9]|from-blue|to-indigo|bg-blue-6" app/` (old palette removed)
   - confirm no DS component is imported with an invented prop (`grep -rn "WorkoutCard"` etc.).
6. Manual checklist per screen (mobile + desktop, light + dark): auth login/register,
   onboarding add/remove/complete, dashboard log+confetti+rest-day, community all four tabs.
7. Delete the now-unused `AuthContainer` only after confirming no remaining imports
   (`grep -rn "AuthContainer" app/`).

---

## Suggested commit boundaries

One commit per phase (`feat(auth): …`, `feat(dashboard): …`, …) on
`feat/design-system-rollout`, so review is incremental. Open the PR against `develop`
(rebasing once `design-system-storybook` lands).

## Execution

Run phases consecutively with `/do`, or hand each phase to a fresh context. Phase 0 must
complete (adapters exist) before Phases 2–5.
