# Community Module

The `community` module contains social features, coaching workflows, and leaderboard views.

> **⚠ Feature-flagged OFF** (owner decision 2026-07-10: users shouldn't see
> each other for now). `lib/feature-flags.ts` `isCommunityEnabled()` gates:
> the `/community` layout (redirects to `/dashboard`), the discover API
> (404), the Community nav item, the dashboard group-streak nudge, and the
> social server actions (clubs, follows, groups — rejected server-side, since
> actions stay callable even with their UI hidden). Coach flows
> (invite-code generate/redeem, plan assignment) remain enabled.
> While off, `AddCoachByCodeForm` renders on `/profile` so trainees can
> still redeem coach invite codes. **No code was removed** — re-enable by
> setting `NEXT_PUBLIC_FEATURE_COMMUNITY=on` and redeploying.

## Scope

- **Leaderboards**
  - `Global League`: weekly app-wide ranking from `xp_transactions`
  - `My Club`: ranking for members of the user's primary club
  - `My Circle`: ranking for followed users (`social_graph`)
- **Club Management**
  - Create club
  - Join by invite code
  - Leave club
  - Set primary club
- **Circle (friends + my coaches)**
  - Following list, user search + follow/unfollow
  - Trainee-side coaching: list my coaches, connect via invite code
    (the dedicated Coaching tab was removed; coach-side tools live in
    the `app/coaching` hub — see its README)
- **Group Streaks**
  - Create a group / join by invite code (2–10 members, RPC-only writes)
  - Shared streak: grows and pays every member bonus XP on days when
    everyone logged a workout; a skipper freezes (never resets) it
  - Member roster with trained-today dots + weekly XP ranking

## Main Files

- `app/community/layout.tsx`: shared shell, header, and tab bar for all segments
- `app/community/{boards,clubs,circle,groups}/page.tsx`: per-segment pages
- `app/community/page.tsx` + `coaching/page.tsx`: legacy redirectors
  (old `?tab=` URLs and the removed Coaching tab → Circle)
- `app/community/actions.ts` + `groups/actions.ts`: server actions
- `app/community/lib/{boards,coaching,clubs,circle,groups}-data.ts`: per-segment data loading
- `app/community/lib/normalizers.ts`: shared query normalizers and leaderboard builder
- `app/community/components/*`: UI components
- `app/community/api/discover/route.ts`: discover search endpoint

## UX and Performance

- Tabs are route segments with `Link`-based navigation (`CommunityTabs.tsx`);
  each segment has its own `loading.tsx` skeleton.
- Each segment fetches only its own data to avoid unnecessary queries.
- Leaderboard data falls back to profile XP when weekly aggregation is unavailable.

## Terminology

User-facing copy says **"trainee"** everywhere; code and database identifiers
keep **"student"** (`student_id`, `p_student_id`, `StudentRelationship`,
role value `"student"`). Never rename the identifiers to match the copy.

## Coach Invite Join Reliability Fix

The trainee add-coach flow now distinguishes these outcomes explicitly:

- `created`: relationship inserted
- `already_connected`: relationship already exists and is active
- `reactivated`: existing relationship was made active again

This prevents false success states and enables correct toast behavior.

Related migration:

- `supabase/migrations/20260215143000_fix_join_coach_statuses.sql`

## Notifications

Transient success/error/info states are displayed via Sonner toasts.

- Shared hook: `components/hooks/use-action-toast.ts`
- Global renderer: `components/ui/sonner.tsx`

