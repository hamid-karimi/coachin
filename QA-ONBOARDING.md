# QA Onboarding — Coachin

A guide for QA to understand what Coachin is, how it fits together, and how to
test it. Written for someone new to the product; every module links to a
deeper README maintained by the team.

## What the app is

Coachin is a training + gamification app: users plan a weekly training
routine, generate AI training programs (running or muscle building), log
sessions and meals, and earn XP / streaks / league tiers for consistency.
Coaches connect to trainees via invite codes and can monitor adherence,
generate plans for them, and (with consent) see their nutrition.

Stack: Next.js (App Router) + Supabase (Postgres with row-level security).
All rules for XP, streaks, tiers, goals, and date math live in
[`FORMULAS.md`](FORMULAS.md) — **that file is the source of truth** when you
need to check whether a number is correct.

## Roles

Stored in `profiles.role`. User-facing copy says **"trainee"**; the code and
database say "student" — that's intentional, don't report it as a bug.

| Role | Lands on | Can |
| --- | --- | --- |
| `student` (default) | `/dashboard` | Everything trainee-side |
| `coach` | `/coaching` | Coach hub only surfaces + own training |
| `both` | `/dashboard` | Trainee + coach surfaces |
| `admin` | `/dashboard` | Everything |

A coach-trainee link is created when the trainee redeems a coach's invite
code (Coaching → Invite codes). Links are per sport and can be active or
inactive; every coach feature checks for an **active** relationship.

## Module map

| Route | What it does | Docs |
| --- | --- | --- |
| `/onboarding` | "My week" editor: fixed weekly sessions (anchors) + weekly targets (quotas). Also the first-run flow. | [README](app/onboarding/README.md) |
| `/dashboard` | "Today": today's routine + plan items, logging, streaks, hearts, XP | [README](app/dashboard/README.md) |
| `/calendar` | Week view blending routine + all active plan items + logged state | [README](app/calendar/README.md) |
| `/training` | Program manager: create (AI wizards), archive, weekly check-ins | [README](app/training/README.md) |
| `/training/new` | Plan wizards (running / muscle building); coach mode via `?student=<id>` | [README](app/training/README.md) |
| `/nutrition` | Meal logging (search / photo / manual), targets, trends, AI meal plan | [README](app/nutrition/README.md) |
| `/coaching` | Coach hub: roster, adherence, invite codes, leaderboard, per-trainee actions | [README](app/coaching/README.md) |
| `/community` | Social/leaderboard surfaces | [README](app/community/README.md) |
| `/profile` | Body metrics, goals, measurements, photos, settings (theme, nutrition sharing) | — |
| `/auth` | Login / signup | [README](app/auth/README.md) |

## Core journeys to test

### 1. Onboarding & weekly routine

1. New account → `/onboarding`. Tap **"Add to my week"** — a bottom sheet
   opens: step 1 pick a sport (chips; picking advances automatically), step 2
   choose **Fixed session** (day strip + optional time / repeat-until) or
   **Weekly target** (sessions-per-week stepper).
2. The **Add button is never disabled**: submitting without a day/sport must
   show an inline message pointing at what's missing (e.g. "Pick at least one
   day"), not fail silently.
3. Expect ~17 sports including Football, Basketball, Boxing, Tennis,
   Volleyball, Martial arts, Climbing, Hiking, Rowing, Dance, Table tennis,
   Badminton — each with a sensible icon.
4. Fixed sessions become "required days" for the streak; weekly targets are
   informational only (never affect streaks/hearts/XP — FORMULAS.md §11).

### 2. AI training plans

1. `/training` → New plan → Running (habit or race) or Build muscle. The
   wizard prefills from the body profile (Profile → body metrics).
2. Generated plan items must have a **short title** (e.g. "Upper body — Day
   A"), with the full exercise list in the item's detail sheet/description —
   never a paragraph-long title.
3. One active plan per discipline: generating a second plan of the same kind
   archives the old one (warned in the UI).
4. Weekly check-in appears on the program card once a plan week fully
   elapses; it produces a scorecard and an advance/repeat/deload decision
   (FORMULAS.md §7).

### 3. Logging on Today (dashboard)

1. Routine sessions log via the workout card ("Log it") — awards XP scaled by
   the sport's multiplier, advances the streak, fires confetti.
2. Plan items (run/strength) are marked done via the check button — **gated
   to the item's day (+1 day)**; earlier days show an "Opens <date>" tooltip.
3. After marking a strength item done, "Log details" opens the per-set
   editor: exercises prefilled from the prescription, one weight×reps row per
   set, add/remove sets and exercises, live "Total volume" line. Saving shows
   "+10 XP" and, when weights were entered, "You lifted N kg total — that's
   a <thing> 🚗/🐘" + confetti. **Volume must never change the XP amount.**
4. Logging the same plan item twice must be rejected ("Session already
   logged").

### 4. Calendar

1. Week view (Mon-first), `?week=` navigation, "Today" badge on the current
   day; a day shows "logged" once any completed log exists that date.
2. **Routine rows are tappable**: a sheet opens with recurrence info, a link
   to the routine editor, and — only on today's card — a "Log it on Today"
   button that goes to `/dashboard`. Other days show a hint, not a button.
3. Plan items open a read-only detail sheet (short title, full description,
   notes, video link). Two hard sessions on one day show the "2 intense
   workouts" chip.
4. **Meal adherence** (only with an active meal plan): today's and past day
   cells show a muted line under the meals link, e.g. "2/3 meals logged · 85%
   of plan kcal" ("No meals logged" when nothing was logged). Future days keep
   the plain "N meals planned" link with no adherence. It's informational —
   never changes XP, streaks, or hearts (FORMULAS.md §13, Meal adherence).

### 5. Nutrition

1. Log meals by search (local + USDA), photo (AI proposes, user must review —
   nothing auto-saves), or manual entry; household units convert to grams.
   Photo mode accepts **up to 3 photos of the same meal** (angles or a
   package-label shot — the label should win over visual guessing) plus an
   optional text hint ("restaurant pizza, large"); the result is still ONE
   merged item list to review.
1. **Country-aware suggestions**: with a country set on the profile (Profile →
   Body profile → Country, free text like "Iran"), generated meal plans should
   prefer local dishes and locally available ingredients, and must **never
   quote prices**. Without a profile country the deployed app falls back to
   IP-based country detection — profile always wins.
2. Daily kcal/macros bar tracks the `calorie_intake` goal; hitting the goal
   day awards the adherence bonus (FORMULAS.md §8).
3. AI meal plan (`/nutrition/plan`) builds a 7-day menu from body metrics +
   training load and points the calorie goal at its target.
4. With an active meal plan: the dashboard shows a **"Today's meals"** card
   (today's menu, kcal total vs target, "Full meal plan" link) and every
   calendar day cell ends with a "N meals planned · X kcal" link to the plan.
   Both disappear when the plan is archived/discarded. The menu repeats
   weekly (keyed by weekday), so the same weekday always shows the same
   meals — that's intentional.
5. **Daily stack (supplements)** on the dashboard: "Add" opens a sheet
   (name + optional dose + **schedule**) → items appear as a daily checklist.
   Checking one marks it taken for today only (unchecked again tomorrow);
   "Manage" lists the whole stack (with each item's schedule label), edits a
   schedule inline, and deletes items. Verify double-tapping a checkmark
   doesn't error, and that supplements **never change XP, streak, or hearts**
   (FORMULAS.md §13).
6. **Schedules**: a supplement can be Every day / Training days / Custom
   weekdays. The checklist and "X of Y taken" tally show only supplements
   **due today**; the rest live in Manage. Verify a "Training days" supplement
   shows on a day with a planned/routine session and hides on a rest day — but
   if you have **no** plan or routine at all it shows every day (degrades to
   daily, never stranded). A "Custom" supplement shows only on its chosen
   weekdays.

### 6. Coaching

1. Coach generates an invite code (per sport); trainee redeems it → appears
   on the roster with level, weekly XP, and the 7-dot adherence strip.
2. **Assign plan** copies the coach's own weekly schedule onto the trainee
   (replaces theirs). **Generate plan** opens the AI wizards for that trainee
   (prefilled with the *trainee's* body profile); the resulting plan applies
   to the trainee immediately and their program card shows "By your coach".
   A coach must never be able to generate for a non-trainee (try tampering
   with the `?student=` URL — expect a redirect).
3. **Nutrition sharing**: trainee turns on Profile → Settings → "Share
   nutrition with my coach" → a "Nutrition" link appears on the coach's
   roster row → read-only last-7-days meal view **plus a read-only "Daily
   stack" section** (each supplement's dose, schedule, and a "5/7 due days"
   7-day taken rate). Turning the toggle off must revoke access immediately —
   both the meals and the stack sections then show the opt-in explainer.
   Coaches must never be able to edit trainee meals or supplements.

### 7. Watch-data import (Profile)

1. Profile → **Watch data** → upload .fit/.gpx exports (≤3 files) → parsed
   runs listed (date · km · min) → "Log N runs" saves them as completed
   workouts with XP (60 × running multiplier each) and they appear on the
   calendar.
2. Rules to verify (FORMULAS.md §14): runs older than **14 days** or in the
   future are skipped; a date that already has a logged run is skipped;
   **re-importing the same file imports nothing** (no double XP).

### 8. Share cards & progress (Profile + logging surfaces)

1. **Share cards**: after logging a strength session with weights, "Share
   it" opens a preview sheet — Story/Square formats, optional photo, Share
   (native share sheet on mobile) or Save image on desktop. Same sheet from
   the nutrition day summary ("Share today") and each meal row's share icon.
   Verify: the "coachin" watermark is always on the image; **body weight
   never appears on a card**; nothing posts anywhere without the OS share
   sheet or an explicit save.
2. **Progress photos** (Profile → Progress photos): add photos (they're
   re-encoded — EXIF/location stripped — and AI-screened; reports are
   rejected here), max 24; Compare → pick two → oldest shows left →
   "Share progress" builds a two-photo card after an explicit consent note.
   Dashboard shows a quiet "add a progress photo" hint for active users
   after 28+ days without one.
3. **Progress charts** (Profile → Progress): weekly volume bars, weekly km,
   body-weight trend (needs ≥2 measurements), and top-set trends for
   exercises logged ≥3 times. Charts hide individually without data; an
   explainer shows when everything is empty. Values must match the raw logs.

## Gamification rules QA must know

All from [`FORMULAS.md`](FORMULAS.md) — spot-check against it, not intuition:

- XP: routine workout log = 60 × sport multiplier; plan-item completion is a
  fixed per-type amount; session-log detail = fixed +10 (idempotent); meal
  logging and daily calorie adherence have their own fixed awards.
- Levels: every 1000 XP. Streaks count **days**, driven by fixed-session
  required days; hearts absorb missed required days.
- Weekly targets (quotas), strength **total volume**, and **supplements**
  are informational / celebration only — they never move XP, streaks,
  hearts, or tiers.

## Running the app locally

```bash
pnpm install
pnpm dev            # Next.js dev server on :3000
pnpm test           # vitest unit suite
pnpm storybook      # component workbench on :6006
```

- Env: `.env.local` needs the Supabase URL/key plus AI keys (Gemini /
  Anthropic; USDA key for food search). Ask a developer for a filled file —
  there is no `.env.example` yet.
- Database: Supabase migrations live in `supabase/migrations/` and are
  applied with the Supabase CLI. There is **no seed script**; create test
  accounts by signing up. For a coach account, have a developer set
  `profiles.role = 'coach'` (or `'both'`) on your user, then exercise the
  invite-code flow to link a trainee account. Testing coach features needs
  **two** accounts (coach + trainee), ideally in separate browser profiles.

## Reporting bugs

Always include:

1. **Route** (URL) and **role** (student / coach / both) you were signed in as
2. Steps to reproduce, numbered, starting from a known page
3. Expected vs actual (quote exact copy — wording bugs count)
4. Screenshot or recording, and the local date/time (much of the app is
   date-math driven — a bug at 23:55 Sunday may be a week-boundary bug)
5. Whether it reproduces on a fresh account

Known intentional behaviors (not bugs): "student" naming in code/DB; weekly
targets never affecting streaks; plan-item completion gated to its day;
one active plan per discipline; quotas/volume having no XP effect.
