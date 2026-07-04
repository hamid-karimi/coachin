# Coaching Module

The `/coaching` route is the dedicated hub for coach-side workflows. Users
whose `profiles.role` is `coach` land here after login (`lib/roles.ts`
`homeFor`); `both`/`admin` can reach it from the nav's Coaching item or the
dashboard coaching card.

## Scope

- **Trainee roster**: every active trainee with level, weekly XP, this week's
  adherence strip, and a plan-assignment action
- **Invite codes**: generate per-sport coach invite codes
- **Trainee weekly leaderboard**: trainees ranked by weekly XP
  (`get_weekly_leaderboard` RPC)
- **Adherence ("Trained this week")**: 7-dot Monday-first strip per trainee —
  done / missed / planned-today / planned / rest

## Main Files

- `page.tsx`: server page — auth + role guard (`canCoach`), renders sections
- `lib/coaching-hub-data.ts`: single data loader (`getCoachingHubData`) plus
  the lightweight `getCoachingSummary` used by the dashboard coaching card
- `components/TraineesSection.tsx`: roster (moved from community's
  `StudentsSection`)
- `components/AdherenceWeekStrip.tsx`: pure 7-dot week strip
- `components/GenerateInviteCodeForm.tsx`: invite-code generation (moved from
  community)
- `loading.tsx`: route skeleton

## Access Control

- Route guard: unauthenticated → `/auth/login` (via `proxy.ts` matcher);
  non-coach roles → `/dashboard` (server-side in `page.tsx`).
- Trainee `logs` are readable by their active coach through the policies in
  `supabase/migrations/20260704120000_logs_policies_coach_read.sql` — the
  adherence strip is EMPTY (not an error) if that migration is not applied.
- Weekly XP comes from the `get_weekly_leaderboard` RPC; raw
  `xp_transactions` of other users are not readable (RLS).

## Terminology

User-facing copy says **"trainee"**; code and database identifiers keep
**"student"** (`student_id`, `p_student_id`, `StudentRelationship`, role value
`"student"`). Never rename identifiers to match the copy.

## Storybook

- `adherence-week-strip.stories.tsx` covers the strip states (done, missed,
  perfect week, rest).
- The roster section has no story: `TraineesSection` renders
  `AssignPlanButton`, whose server-action import cannot be bundled by
  Storybook. Extracting an injectable action prop would enable one later.
