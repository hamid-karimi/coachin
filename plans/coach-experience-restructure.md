# Coach Experience Restructure

Branch: `feat/volt-ember-redesign` (continue) or new `feat/coach-experience` off it.

Three user-approved decisions drive this plan:

1. **Coach hub + smart landing** — new top-level `/coaching` route; users whose
   `profiles.role` is `coach` land there after login; `student` and `both` land
   on `/dashboard`. `both` gets a coaching summary card on the dashboard.
2. **Terminology** — every user-visible "student" becomes **"trainee"**.
   UI copy ONLY. Code identifiers, DB columns, RPC params, role values stay.
3. **Community tabs become route segments** — `/community/boards|coaching|clubs|circle`
   with a shared layout; old `?tab=` URLs redirect. The Community "Coaching"
   segment keeps only the trainee-side ("my coaches", enter code); the
   coach-side moves to `/coaching`.

---

## Phase 0 — Documentation Discovery (CONSOLIDATED — verified against source)

### Roles & gates
- `profiles.role` values in use: `student | coach | both | admin`.
  Gate sets: `COACH_ENABLED_ROLES` / `STUDENT_ENABLED_ROLES` in
  `app/community/actions.ts:14-15` and duplicated in `app/community/page.tsx:24-25`.
  → Extract to `lib/roles.ts` in Phase 3 so route guards reuse them.
- Role fetch pattern to copy: `getCurrentUserAndRole()` in
  `app/community/actions.ts:32-53` (select `role` from `profiles` by `auth.uid()`).

### Coach-side data available TODAY (no migration needed)
- Trainee relationships: `coaching_relationships` SELECT allowed for coach or
  student (`supabase/migrations/20260212010000_social_coaching_mvp.sql:128-133`).
  Query pattern to copy: `app/community/lib/community-data.ts:328-345`
  (`student:profiles(id, email, xp, level, league_tier, full_name, avatar_url), sport_types(id, name)`).
- Trainee profiles (xp, level, streaks, tier): `profiles_select_authenticated`
  explicitly includes `coaching_relationships.coach_id = auth.uid()` targets
  (`supabase/migrations/20260212020000_security_fixes.sql:175-179`).
- Weekly XP for an arbitrary user set: RPC `get_weekly_leaderboard(p_user_ids uuid[], p_limit int)`
  (`supabase/migrations/20260212020000_security_fixes.sql:195-227`);
  call pattern: `app/community/lib/community-data.ts:136-141`.
- Trainee **schedules**: coaches can SELECT/INSERT/UPDATE active trainees'
  schedules (`supabase/migrations/20260214103000_schedules_coach_student_policies.sql:3-50`).
- Assign plan: RPC `assign_coach_schedule_to_student(p_student_id)` via
  `assignCoachWeeklyPlanAction` (`app/community/actions.ts:380-424`);
  UI: `app/community/components/AssignPlanButton.tsx`.
- Invite codes: `coach_invite_codes_manage_own` FOR ALL
  (`social_coaching_mvp.sql:160-166`); UI: `GenerateInviteCodeForm.tsx`.

### Coach-side data NOT available (migration required — Phase 4)
- **`logs` has RLS enabled but ZERO policies in migrations**
  (`20260212000000_initial_schema.sql:148` enables RLS; grep across
  `supabase/migrations/*.sql` finds no `CREATE POLICY ... ON public.logs`).
  The live DB must have ad-hoc policies (the app inserts/reads own logs), so the
  Phase 4 migration must (a) add self policies idempotently AND (b) add the
  coach-read policy, copying the `EXISTS (SELECT 1 FROM coaching_relationships …)`
  clause from `20260214103000_schedules_coach_student_policies.sql:10-18`.
- `xp_transactions` SELECT is self-only (`social_coaching_mvp.sql:251-255`).
  → Weekly XP per trainee must come from the `get_weekly_leaderboard` RPC,
  NOT from raw `xp_transactions`.

### Routing & auth plumbing
- Middleware: `proxy.ts` — guards only `/auth`, `/dashboard`, `/community`
  (`config.matcher`, `proxy.ts:30-32`). New `/coaching` must be added to the
  matcher and the unauth-redirect condition.
- Post-login redirects to change:
  - `app/auth/login/actions.ts:55` → `redirect("/dashboard")`
  - `app/auth/register/actions.ts:81` → `redirect: "/dashboard"`
  - `proxy.ts:17-19` (authed user on /auth → `/dashboard`)
  - Root router: `app/page.tsx` already redirects authed → `/dashboard`;
    it becomes the single role-aware destination decider.
- Community tabs today: query params in `app/community/page.tsx` +
  client `TabNavigation.tsx` (router.push + useTransition + hand-rolled skeleton).
  Data gating per tab already exists in `community-data.ts:287-296` — the seams
  to split along are the flags `isBoardsTab`, `isCoachingTab`, `needsClubs`,
  `needsFollowing`, `isCircleTab`.
- Next.js App Router conventions already used in repo: `loading.tsx`
  (`app/community/loading.tsx`), `redirect()` from `next/navigation`
  (`app/page.tsx`), `layout.tsx` (`app/layout.tsx`). No `route groups` used yet;
  plain nested folders suffice.

### Allowed APIs (do not invent alternatives)
- `redirect(path)` from `next/navigation` (server components/actions).
- `supabase.rpc("get_weekly_leaderboard", { p_user_ids, p_limit })`,
  `supabase.rpc("assign_coach_schedule_to_student", { p_student_id })`.
- Existing server actions in `app/community/actions.ts` — reuse, don't rewrite.
- DS components: `AppShell`, `StatCard`, `TierBadge`, `StreakBadge`,
  `LeaderboardRow`, `ConfirmDialog`, `SportChip/SportIcon`, `LevelRing`
  (all under `components/design-system/`).

### Anti-patterns (repo-wide, all phases)
- ❌ Renaming `student_id` form fields, RPC parameter names, DB columns,
  component-internal type names, or `role` values — "trainee" is UI copy only.
- ❌ Reading `xp_transactions` for other users (RLS blocks it silently → empty).
- ❌ Querying `logs` for trainees before the Phase 4 migration is applied.
- ❌ Role checks in client components — role comes from the server
  (page/layout/action), passed down as props.
- ❌ Fetching `profiles.role` inside `proxy.ts` middleware (extra DB hit per
  request) — the root page `/` does the role routing instead.

---

## Phase 1 — Terminology: "student" → "trainee" (UI copy only)

**Implement**
1. Sweep user-visible strings: `grep -rn -i "student" app components --include="*.tsx"`.
   For every JSX **text node / label / toast / aria-label / placeholder**,
   replace "student(s)" with "trainee(s)". Known sites:
   - `app/community/components/StudentsSection.tsx` (title "My students", empty copy)
   - `app/community/components/GenerateInviteCodeForm.tsx` (helper copy)
   - `app/community/page.tsx` (leaderboard title "My students", whatCounts copy)
   - `app/community/components/AssignPlanButton.tsx` (button/toast copy, if any)
   - server action messages in `app/community/actions.ts`
     ("assigned to the student", role errors) — message strings only.
2. Do NOT touch: `student_id` (form field consumed by
   `assignCoachWeeklyPlanAction` at `app/community/actions.ts:384`),
   `p_student_id` RPC arg, `StudentRelationship` type, `students` prop names,
   DB/RPC identifiers, `STUDENT_ENABLED_ROLES` role value `"student"`.
   (Optional cosmetic rename of components/props comes with the file moves in
   Phase 3, where imports change anyway.)

**Verify**
- `pnpm build` passes.
- Manual grep: every remaining `student` match is an identifier, not display copy.

---

## Phase 2 — Community tabs → route segments

**Implement** (copy conventions from existing files, cited)
1. `app/community/layout.tsx` — server layout rendering the "Community" header
   (copy from current `page.tsx:106-110`) + a `<Link>`-based tab bar
   (visual style copied from `TabNavigation.tsx` TabsList/Trigger markup, but as
   plain links with `aria-current`; active state derived via `usePathname` in a
   small client child, pattern copied from `components/design-system/app-sidebar.tsx:27-33`).
   Tabs: Boards `/community/boards` · Coaching `/community/coaching` ·
   Clubs `/community/clubs` · Circle `/community/circle`.
2. Segment pages, each self-guarding like `app/dashboard/page.tsx:44-48`:
   - `app/community/boards/page.tsx` — reads `searchParams.board` (global|club|circle),
     renders board pills (keep them as buttons/links with `?board=`) +
     `LeaderboardSection` with the whatCounts/empty maps from current `page.tsx:79-104`.
   - `app/community/coaching/page.tsx` — trainee-side only:
     `CoachesSection` (+ `AddCoachByCodeForm`). Coach-side content is REMOVED
     here (moves to `/coaching` in Phase 3; until Phase 3 lands, keep a link
     card "Coaching tools have moved → /coaching" only if phases ship separately).
   - `app/community/clubs/page.tsx` — `ClubMembershipSection`.
   - `app/community/circle/page.tsx` — `FriendsSection` (search `?q=` stays).
3. Split `getCommunityData` into per-segment loaders in
   `app/community/lib/`: `boards-data.ts`, `coaching-data.ts`, `clubs-data.ts`,
   `circle-data.ts` — extract the already-gated blocks from
   `community-data.ts` (`isBoardsTab` block :472-497, coaching block :328-386,
   clubs block :399-423, circle block :443-466). Delete the flags.
4. `app/community/page.tsx` → legacy redirector:
   `redirect("/community/boards")`; map old params
   (`?tab=coaching` → `/community/coaching`, `?tab=leaderboards|boards&board=X`
   → `/community/boards?board=X`, clubs/circle likewise).
5. Per-segment `loading.tsx` files (copy skeleton style from
   `app/community/loading.tsx`); delete `TabNavigation.tsx` and its
   useTransition/skeleton logic; `revalidatePath("/community")` calls in
   `actions.ts` become `revalidatePath("/community", "layout")`.

**Verify**
- `pnpm build` — routes `/community/boards|coaching|clubs|circle` listed.
- `grep -rn "tab=" app` → only the legacy redirector references it.
- Manual: `/community?tab=coaching` 307s to `/community/coaching`; board pills
  still switch boards; follow/join/leave actions still refresh.

**Anti-patterns**
- Don't keep `TabNavigation`'s `useTransition` — segment `loading.tsx` replaces it.
- Don't fetch all four segments' data in the layout.

---

## Phase 3 — `/coaching` hub (coach-side)

**Implement**
1. `lib/roles.ts` — export `COACH_ENABLED_ROLES`, `STUDENT_ENABLED_ROLES`
   (copy sets from `app/community/actions.ts:14-15`), plus
   `canCoach(role)`, `homeFor(role)` (`coach` → `/coaching`, else `/dashboard`).
   Update `actions.ts` and community pages to import from it.
2. `app/coaching/page.tsx` (server):
   - Guard: `getUser()` → login redirect; fetch role (copy
     `community-data.ts:301-307`); `!canCoach(role)` → `redirect("/dashboard")`.
   - Data: relationships query (copy `community-data.ts:338-345`), weekly XP via
     `get_weekly_leaderboard` with trainee ids (copy call `:136-141`),
     invite codes query (copy `:365-369`), sport types (copy `:360-364`).
   - Sections:
     a. Header "Coaching" (font-display, same pattern as Community header).
     b. **Trainee roster** — one row per trainee: avatar, name, sport,
        `Lv · streak · weekly XP` (LeaderboardRow-style), `AssignPlanButton`.
        Move + rename `StudentsSection.tsx` → `app/coaching/components/TraineesSection.tsx`
        (imports change anyway; internal `student` identifiers may stay).
     c. **Invite codes** — move `GenerateInviteCodeForm.tsx` here.
     d. **Trainee weekly leaderboard** — reuse `LeaderboardSection` with
        `whatCounts="your trainees, ranked by weekly XP"`, data from the RPC.
     e. Placeholder slot for Phase 4 adherence ("Trained this week").
3. Nav: `components/design-system/app-sidebar.tsx` + `bottom-nav.tsx` accept an
   optional `coachNav` flag → adds a 5th item `Coaching` (lucide
   `GraduationCap`, route `/coaching`); `AppShell` gains `coachNav?: boolean`
   and threads it through; `keyFromPath` maps `/coaching`. Pages that render
   `AppShell` pass it (dashboard & profile already fetch the full profile;
   community layout fetches role; onboarding may omit → defaults false).
4. `proxy.ts`: add `"/coaching/:path*"` to `config.matcher` and include
   `req.nextUrl.pathname.startsWith("/coaching")` in the unauthenticated
   redirect condition (`proxy.ts:23-25`).
5. `app/coaching/loading.tsx` — skeleton (copy style from community loading).

**Verify**
- `pnpm build`; `/coaching` in route list.
- As non-coach: `/coaching` redirects to `/dashboard`. Unauthed: → `/auth/login`.
- Coach sees roster with weekly XP, can generate a code and assign a plan
  (actions unchanged, so toasts still fire).
- Community/Coaching segment now shows only trainee-side content.

**Anti-patterns**
- Don't duplicate the roster query in components — fetch once in the page.
- Don't gate nav visibility client-side by fetching the profile from the client.

---

## Phase 4 — Logs migration + "Trained this week"

**Implement**
1. New migration `supabase/migrations/<timestamp>_logs_policies_coach_read.sql`,
   copying structure from `20260214103000_schedules_coach_student_policies.sql`:
   - `logs_select_self_or_coach` — FOR SELECT USING
     `user_id = auth.uid() OR EXISTS (SELECT 1 FROM coaching_relationships cr
     WHERE cr.status = 'active' AND cr.coach_id = auth.uid()
     AND cr.student_id = logs.user_id)` (clause copied from `:8-18`).
   - Idempotent self policies (`DROP POLICY IF EXISTS` first):
     `logs_insert_self` (WITH CHECK `user_id = auth.uid()`),
     `logs_update_self`, `logs_delete_self` — codifies whatever the live DB
     has ad-hoc, since migrations currently define NONE for `logs`.
   - Apply with `supabase db push` (or `supabase migration up` per repo workflow —
     confirm with user; do not guess a deploy command beyond these).
2. Adherence data in `app/coaching/page.tsx`: fetch this week's `logs`
   (`.in("user_id", traineeIds).gte("date", monday)`) + trainees' `schedules`
   (readable per `20260214103000`); compute per-trainee "X of Y sessions done".
3. UI: 7-dot week strip per roster row (dot style copied from
   `app/onboarding/components/AddScheduleForm.tsx` week strip) —
   done=success, missed=muted, today=brand ring.

**Verify**
- Migration applies cleanly on a fresh `supabase db reset` (all policies use
  `DROP POLICY IF EXISTS` first).
- As coach, roster shows non-empty adherence once a trainee logs.
- As trainee, own dashboard logging still works (self policies intact).

**Anti-patterns**
- Don't ship the adherence UI without the migration applied — RLS returns empty
  arrays, not errors; it would look "broken but silent".

---

## Phase 5 — Role-aware landing + dashboard coaching card

**Implement**
1. `app/page.tsx`: after `getUser()`, fetch role (copy pattern
   `community-data.ts:301-307`) → `redirect(homeFor(role))` (from `lib/roles.ts`);
   unauthenticated → `/auth/login` (unchanged).
2. `app/auth/login/actions.ts:55` → `redirect("/")`;
   `app/auth/register/actions.ts:81` → `redirect: "/"`;
   `proxy.ts:18` authed-on-auth redirect → `new URL("/", req.url)`.
   (Two-hop redirect through `/` is intentional — keeps role lookup out of
   middleware.)
3. Dashboard coaching card (`role === "both" | "coach" | "admin"` with ≥1 trainee):
   card at top of `app/dashboard/page.tsx` content —
   "🎓 {n} trainees · {m} logged this week" + link → `/coaching`
   (counts from the same relationships query + weekly RPC; skip the logged
   count until Phase 4 is applied, falling back to trainee count only).

**Verify**
- Login as `coach` → lands on `/coaching`; as `student`/`both` → `/dashboard`.
- `both` sees the coaching card; `student` never does.
- `pnpm build`.

---

## Phase 6 — Final verification & polish

1. `pnpm lint` (scope to `app components lib`), `pnpm build`, `pnpm build-storybook`.
2. Grep guards:
   - `grep -rn "tab=" app` → legacy redirector only.
   - `grep -rni "student" app/**/*.tsx` → identifiers only, zero display copy.
   - `grep -rn "redirect(\"/dashboard\")" app/auth` → none.
3. Storybook: stories for the trainee roster row + adherence week strip
   (copy story conventions from `components/design-system/leaderboard-row.stories.tsx`).
4. Manual pass on mobile width (390px): 5-item bottom nav fits; tab bar in
   `/community` layout scrolls or compresses correctly.
5. Update `app/community/README.md` + add `app/coaching/README.md` (mirror the
   existing README style) documenting the trainee terminology mapping
   (UI "trainee" ⇄ code/DB "student").
