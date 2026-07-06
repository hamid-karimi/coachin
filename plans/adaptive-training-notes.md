# Adaptive Training System — Decisions & Brainstorm Notes

Captured 2026-07-05 from product brainstorming sessions. This is the "why"
document; the phased implementation lives in `plans/adaptive-training-plan.md`.

## Context

The race planner was just generalized to any distance (branch
`feature/race-plan-any-distance`): 5k → ultra, experience levels
(new/recreational/regular/competitive), first-time-at-distance detection.
The next questions were (a) other sports, (b) how the system verifies progress
and keeps users on the line.

Business context that shaped these decisions: the monetization direction is
coach subscriptions (B2B2C) plus an AI premium tier for self-coached users.
Germany-first launch. Competitive gap identified: no competitor (TrueCoach,
Everfit, TrainHeroic, Traindoo, GAINSFIRE) closes the athlete-side loop of
train → eat → photograph → adapt. The trainee experience is our moat.

## Decision 1 — Don't build "any sport"; build the second sport well

A training plan is only credible if the system can **measure** what the plan
improves. Sport candidates ranked by measurability with what we already have:

| Sport | Progress signal | Already captured? |
|---|---|---|
| Bodybuilding / hypertrophy | Load progression (sets×reps×weight), body composition, protein | Mostly — body-photo AI, meal logging, `strength` item type |
| General fitness / weight loss | Adherence + weight trend + calories | Yes — streaks, body metrics, nutrition |
| Cycling / triathlon | Power, pace, volume | Partial (.fit parsing); Garmin/Strava own this audience |
| Team sports / climbing / swim technique | Skill-based, unmeasurable from logs | No — avoid |

**Chosen: bodybuilding/hypertrophy as sport #2.** Our three AI assets
(body-photo analysis, meal-photo logging, plan generation) combined are
exactly the bodybuilding loop. Structurally cheap: `plan_items.details` is
JSONB, so `{sets, reps, weight_kg, rir}` slots in like `distance_km` does.

**"General fitness" is not a sport** — it's the default onboarding path for
"I just want to get in shape": habit-based plan, no race date. Widens the
consumer funnel without sport-specific work.

## Decision 2 — The feedback loop is the product; the generator is a demo

Anyone can call an LLM to emit a 12-week table. Almost nobody closes the
loop. Weekly OODA cycle:

1. **Observe** — completions, logged sessions, watch files, meals, weight,
   body photos. Gap to fix: optional per-set logging for strength items
   (never mandatory — required data entry kills fitness apps).
2. **Orient** — deterministic weekly scorecard, no AI: adherence % (planned
   vs completed), volume trend, load progression, weight/photo trend vs goal.
3. **Decide — rules first, AI second.** Deterministic guardrails:
   - missed >50% of a week → repeat the week, don't advance
   - missed two weeks straight → auto-deload week
   - volume far under plan → recompute progression
   - injury note in a session log → flag, don't auto-adjust
   The AI only rewrites **next week's items** within these rules and explains
   why in ≤2 sentences. Never silently regenerate the whole plan — trust dies
   when a plan reshuffles itself unexplained.
4. **Act — weekly check-in ritual.** Sunday: scorecard + proposed adjustment
   + one confirm button. XP/streak reward for reviewing the week (the
   gamification layer finally rewards something meaningful).

**Build once, sell twice:** the same scorecard is the coach dashboard
("3 of your 12 trainees are off-track this week") — the adherence-visibility
pitch from the Germany campaign.

## Decision 3 — Per-session logger with AI feedback (user addition)

Each completed plan item gets an optional session log, shaped by sport:

- **Running session:** actual distance/duration, RPE (1–10), optional watch
  file attach, free-text note ("knee felt tight after 8k").
- **Bodybuilding session:** per-exercise sets × reps × weight actually done,
  RPE, free-text note.

After logging, AI gives short session feedback (compare planned vs actual,
flag red lines like pain mentions, one actionable tip). Session logs feed the
weekly scorecard — they are the Observe layer, not a separate feature.

## Decision 4 — YouTube how-to links (user addition)

Every plan item (exercise, stretch, drill) should show the user how to
perform it. **Anti-pattern to avoid: letting the LLM emit YouTube URLs —
it hallucinates video IDs.** Instead:

- AI emits a `video_query` string per item (e.g. "bulgarian split squat form").
- UI renders a "Watch how ▶" link to `youtube.com/results?search_query=...`
  — always valid, zero maintenance, no API key.
- Later upgrade path: curated exercise library table mapping exercise slugs
  to vetted video URLs (own content or licensed), replacing search links
  progressively. Optional YouTube Data API validation if we want embedded
  players.

## Decision 5 — Runners get support work explicitly (user addition)

Current state: the generator already emits `strength` (1-2x/week) and
`stretch` (1x/week) items, but nothing guarantees they're runner-specific.
Changes:

- Prompt requires runner-specific strength (hips/glutes/calves/core,
  single-leg bias) — "bodybuilding for runners", not generic gym work.
- Add `mobility` item type (yoga/mobility flows) alongside stretch.
- Every strength/stretch/mobility item gets a `video_query` too.

## Open question (parked, answer before bodybuilding intake ships)

One active plan per user (today's model) vs concurrent plans (marathon +
strength simultaneously — realistic athlete behavior, but requires a shared
recovery budget in the adaptation logic and turns `/marathon` into `/plans`).
Decision deferred until the loop works for one plan.

## Riskiest assumption

Users log enough for the loop to have signal. Cheapest test: measure the
logging decay curve of existing marathon-plan users; if week-4
completion-logging retention < ~40%, fix capture friction (watch-file
auto-import) before building more intelligence.

## Sequencing rationale

1. Session logger + scorecard + check-in on **existing running plans** first
   — proves the loop with zero new sports.
2. Video links + runner support work — small, independent, high perceived value.
3. Bodybuilding intake last — inherits logger, scorecard, check-in, and
   video links for free.
