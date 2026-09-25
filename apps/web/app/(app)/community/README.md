# Community module

Social surfaces, **feature-flagged off** (`FEATURE_COMMUNITY`, default false): while off
the nav item is hidden, `/community/*` redirects to `/dashboard` (`layout.tsx`), and every
`/api/v1/community/*` route answers 404 (`communityOnly` middleware) — the endpoints don't
exist rather than being hidden. Coach invite codes are redeemed on Profile → "My coach"
meanwhile.

## API (Go: `apps/api/internal/app/community`)

| Call | What |
| --- | --- |
| `GET /community/leaderboard?board=global\|club\|circle` | Up to 50 rows ranked by this week's XP (`get_weekly_leaderboard`) — everyone, the primary club's members, or the people you follow. When nobody on the board earned XP this week, ranked by lifetime XP instead (`weekly: false`, legacy). Rows: rank, name (else "Athlete"), avatar, level, tier, XP, `isYou` — no email. `primaryClubName` names the My Club board |
| `GET /community/clubs` | Your memberships (name, invite code, role, primary) |
| `POST /community/clubs` | `{name, description?}` → `create_club_with_owner` with a random `CLUB-XXXXXX` code (retried on a clash); you own it and it's primary if you had none. "Club created. Invite code: …" |
| `POST /community/clubs/join` | `{code}` → `join_club_via_invite_code` (primary if none); rate limited |
| `PUT /community/clubs/{id}/primary` | Moves the primary flag (one transaction) |
| `GET /community/circle` | Who you follow and your active coaches (sport, level) |
| `GET /community/people?q=&page=` | Others ranked by lifetime XP, 10 per page (`hasNext`); `q` matches names (wildcards literal) or a complete email exactly — never partial emails, and emails are never returned. Each row says whether you follow them. Rate limited |
| `POST /community/follows` · `DELETE /community/follows/{id}` | `{userId}` → "User followed." (400 yourself, 404 unknown user, 409 already following) / "User unfollowed." |
| `DELETE /community/clubs/{id}/membership` | Leaves; a primary club hands primary to your oldest remaining club (one transaction) |
| `GET /community/groups` | Settles each of your groups' finished days first (`evaluate_group_days`, FORMULAS §2 group streak), then: name, invite code, streak / best, the last 7 settled days, members (most XP this week first, `trainedToday`, `isYou`) |
| `POST /community/groups` | `{name}` (3–60 characters) → a random `GRP-XXXXXX` code (retried on a clash); "Group created — share code … with your friends." |
| `POST /community/groups/join` | `{code}` (any case) → "Joined the group." / info "You are already in this group."; 404 "Invite code not found", 409 "This group is full (10 members max)". Rate limited |
| `DELETE /community/groups/{id}/membership` | "You left the group."; the last one out deletes it; 404 when not a member |
| `GET /community/group-nudge` | `{groupName?, streakCount}` — your longest live group streak while you've logged nothing today (Today's nudge) |

## Structure

- `layout.tsx` — flag guard (`getMe().features.community`), heading, `community-tabs.tsx`
- `page.tsx` — redirects to `/community/boards`
- `boards/page.tsx` — `?board=` resolved in `lib/community.ts`, prefetched;
  `components/leaderboard-view.tsx` (pills + `design-system/leaderboard-row`)
- `clubs/page.tsx` — `components/clubs-view.tsx` (memberships, make primary, leave with
  confirm) and `club-forms.tsx` (create / join)
- `circle/page.tsx` — `components/circle-view.tsx` (following, `people-search.tsx` with a
  debounced query and paging, "My coaches" + Profile's `join-coach-form.tsx` for roles
  that can have a coach — `lib/roles.canTrain`); rows are `person-row.tsx` with
  `follow-button.tsx`
- `groups/page.tsx` — `components/groups-view.tsx` (`group-forms.tsx` create / join,
  `group-card.tsx` per group: code line, streak, 7 day dots, members as `person-row.tsx`
  without a tier, leave with confirm)
- `hooks/use-community.ts` — queries and mutations (club changes refetch clubs and boards;
  follows refetch the circle, search, and boards; group changes refetch groups and the
  Today nudge)
- `lib/community.ts` — boards, per-board title / rules / empty copy, group streak / code /
  nudge lines (unit-tested)
- Today's `dashboard/components/group-nudge.tsx` links here; prefetched only while the
  flag is on

## Differences from legacy

- Leaderboard rows never include email (legacy sent every user's email to every viewer
  and used it as the fallback name); the database function no longer returns it either.
- Other people are read through `profile_cards` (name, avatar, XP, level, tier) — their
  profile row (email, body data) is private to them and their active coach / trainee
  (migration 00011, `plans/go-backend-rewrite/security-review.md`).
- Clubs are readable by their members only (legacy exposed every club's invite code).
- Club reads go through your memberships only; leaving and switching primary are single
  transactions.
- Club names are capped at 80 characters, descriptions at 500.
- People search no longer matches partial emails (legacy's "search by name or email"
  listed everyone at a given email domain); a full address still finds that one person.
- Following an unknown user id is refused (the `following_id` column has no foreign key).
- Group members' "XP this week" is real (legacy matched the weekly board on the wrong
  column, so every member showed 0).
- A new group settles from the day it got its 2nd member (legacy settled yesterday on the
  first look, so a group created today could pay every member for a day before it
  existed — repeatable with fresh groups).
