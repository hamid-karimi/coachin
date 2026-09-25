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
| `DELETE /community/clubs/{id}/membership` | Leaves; a primary club hands primary to your oldest remaining club (one transaction) |

## Structure

- `layout.tsx` — flag guard (`getMe().features.community`), heading, `community-tabs.tsx`
- `page.tsx` — redirects to `/community/boards`
- `boards/page.tsx` — `?board=` resolved in `lib/community.ts`, prefetched;
  `components/leaderboard-view.tsx` (pills + `design-system/leaderboard-row`)
- `clubs/page.tsx` — `components/clubs-view.tsx` (memberships, make primary, leave with
  confirm) and `club-forms.tsx` (create / join)
- `hooks/use-community.ts` — queries and mutations (club changes refetch clubs and boards)
- `lib/community.ts` — boards, per-board title / rules / empty copy (unit-tested)

## Differences from legacy

- Leaderboard rows never include email (legacy sent every user's email to every viewer
  and used it as the fallback name).
- Club reads go through your memberships only; leaving and switching primary are single
  transactions.
- Club names are capped at 80 characters, descriptions at 500.

## Not yet ported

Circle (follows, user search, my coaches) — 3.8b; group streaks and Today's group
nudge — 3.8c.
