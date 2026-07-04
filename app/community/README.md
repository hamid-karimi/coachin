# Community Module

The `community` module contains social features, coaching workflows, and leaderboard views.

## Scope

- **Leaderboards**
  - `Global League`: weekly app-wide ranking from `xp_transactions`
  - `My Club`: ranking for members of the user's primary club
  - `My Circle`: ranking for followed users (`social_graph`)
- **Coaching Zone**
  - List my coaches and students
  - Generate coach invite codes per coach + sport
  - Connect student to coach via invite code
  - Assign coach weekly schedule to students
- **Club Management**
  - Create club
  - Join by invite code
  - Leave club
  - Set primary club
- **Friends Management**
  - Following list
  - User search + follow/unfollow

## Main Files

- `app/community/layout.tsx`: shared shell, header, and tab bar for all segments
- `app/community/{boards,coaching,clubs,circle}/page.tsx`: per-segment pages
- `app/community/page.tsx`: legacy redirector mapping old `?tab=` URLs to segments
- `app/community/actions.ts`: server actions for social/coaching operations
- `app/community/lib/{boards,coaching,clubs,circle}-data.ts`: per-segment data loading
- `app/community/lib/normalizers.ts`: shared query normalizers and leaderboard builder
- `app/community/components/*`: UI components
- `app/community/api/discover/route.ts`: discover search endpoint

## UX and Performance

- Tabs are route segments with `Link`-based navigation (`CommunityTabs.tsx`);
  each segment has its own `loading.tsx` skeleton.
- Each segment fetches only its own data to avoid unnecessary queries.
- Leaderboard data falls back to profile XP when weekly aggregation is unavailable.

## Coach Invite Join Reliability Fix

The student add-coach flow now distinguishes these outcomes explicitly:

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

