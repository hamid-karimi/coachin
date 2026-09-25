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
**On `feat/backend-rewrite-with-go`** the same app is being rebuilt as a Go API +
frontend-only Next.js on Docker (no Supabase). Modules move over one at a time; until
a module is ported its page is a placeholder. Journey 0 below covers what already runs
there — see "Running the app locally" for that stack.
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
| `/onboarding` | "My week" editor: fixed weekly sessions (anchors) + weekly targets (quotas). Also the first-run flow. **Ported to the rewrite.** | [README](apps/web/app/(app)/onboarding/README.md) |
| `/dashboard` | "Today": today's routine + plan items, logging, streaks, hearts, XP. **Ported to the rewrite**, including the daily stack. | [README](apps/web/app/(app)/dashboard/README.md) |
| `/calendar` | Week view blending routine + all active plan items + logged state. **Rewrite: ported** (meal-plan line arrives with Nutrition) | [README](apps/web/app/(app)/calendar/README.md) |
| `/training` | Program manager: create (AI wizards), archive, weekly check-ins. **Rewrite: list, archive, .ics export, AI wizards (with watch-file upload), check-ins ported**. | [README](apps/web/app/(app)/training/README.md) |
| `/training/new` | Plan wizards (running / muscle building); coach mode via `?student=<id>` | [README](legacy/app/training/README.md) |
| `/nutrition` | Meal logging (search / photo / manual), targets, trends, AI meal plan. **Rewrite: fully ported** (search / USDA / photo / manual logging, day summary, trends, `/nutrition/plan`) | [README](apps/web/app/(app)/nutrition/README.md) |
| `/coaching` | Coach hub: roster, adherence, invite codes, leaderboard, per-trainee actions | [README](legacy/app/coaching/README.md) |
| `/community` | Social/leaderboard surfaces — **currently disabled** (feature flag; redirects to dashboard, nav item hidden). Coach invite codes are redeemed on `/profile` → "My coach" while off. | [README](legacy/app/community/README.md) |
| `/profile` | Four tabs (`?tab=`): **Overview** (stats, hearts, goals, recent XP), **Progress** (charts, measurements, progress photos), **Body** (body profile, body photos, watch import), **Settings** (theme, nutrition sharing, my coach, logout). **Rewrite: tabs, goals, measurements, charts, body profile, sharing, watch import ported**; photos next | [README](apps/web/app/(app)/profile/README.md) |
| `/auth` | Login / signup; on the rewrite also forgot / reset password and email verification | [README](legacy/app/auth/README.md) |
| `/status` | Rewrite only: API, database, and storage health | — |

## Core journeys to test

### 0. Accounts & sign-in (rewrite stack)

Run `make up` then `make seed`; demo accounts `trainee@coachin.local` /
`coach@coachin.local`, password `Coachin-demo1`. Emails land in Mailpit
(http://localhost:8025).

1. Open http://localhost:8080 signed out → you land on `/auth/login`. Any app page
   (`/dashboard`, `/profile`, `/coaching`…) also sends you there.
2. Wrong password → "Invalid login credentials". Correct password → trainee lands on
   `/dashboard`, coach on `/coaching` (`both`/`admin` on `/dashboard`).
3. Nav: Today, Training, Calendar, Nutrition/Meals, Profile for everyone; **Coaching**
   only for coach/both/admin; **Community** only when `FEATURE_COMMUNITY=true`. A trainee
   opening `/coaching` directly is sent to `/dashboard`.
4. Signed in, opening `/auth/login`, `/auth/register`, or `/auth/forgot-password` sends
   you to your home.
5. Register a new account → signed in immediately; a "Confirm your CoachIn email"
   mail arrives; its link confirms the address once (second click: "This link is
   invalid or has expired"). Duplicate email (any case) → "User already registered".
   The password checklist ticks live; the rules are 8+ chars with upper, lower, number.
6. Forgot password → always the same success message (even for unknown addresses); the
   mailed link opens `/auth/reset-password`; after a reset, every other signed-in
   browser is signed out.
7. Profile → Password: wrong current password → "Current password is incorrect";
   success keeps this browser signed in and signs out other devices.
8. Profile → Log out (confirm dialog) → back on `/auth/login`; `/dashboard` now
   redirects to sign in.
9. A burst of more than 10 auth attempts from one address → "Too many attempts. Please
   wait a minute and try again." (one more attempt frees up every 6 s).

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

**Rewrite stack** (`make seed` trainee already has Mon/Wed Running 07:00 and Fri
Strength training 18:30): reach `/onboarding` from Today → **Edit my week** (the
Training tab is highlighted there).
- Saving shows a toast — "1 session added to your schedule.", "Weekly target saved.",
  "Weekly target removed.", "Activity removed from your schedule." — the sheet closes
  and the agenda updates without a page reload.
- Adding a weekly target for a sport that already has one **updates** it (still one
  row). Badge reads `done/target this week`, counting distinct days with a completed
  log of that sport, Monday–Sunday; it turns volt once met.
- The footer shows "N days planned · est. ~X XP / week" (60 XP × sport multiplier
  per fixed session, FORMULAS.md §1); **Finish** is disabled until one fixed session
  exists and goes to Today.
- With an active AI plan, this week's plan sessions show read-only (neutral cards,
  "AI plan" tag, legend above); tapping one opens its details (stat line, notes,
  type, day, "Watch how"). Only the newest active plan is shown.
- Today's row has a volt rail and a "today" pill (your device's date).
- Another user's sessions/targets can never be seen or removed (API filters by
  the signed-in user; the database enforces it too).

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

**Rewrite stack — `/training` (3.3a)**: "My programs" lists active plans (hypertrophy
first, as before) with "Race in N days · Week X of Y · goal …", "By your coach" when a
coach generated it, and the "Week N review ready" banner when last week ended without a
check-in. "Add to calendar" downloads `coachin-training-plan.ics` (all-day events, meal
notes excluded). "Archive plan" (confirm) → "Plan archived."; with no plans the page
shows "Create a plan" and Today shows "Train for a marathon".

**Rewrite stack — plan generation (3.3b)**: New plan → Running / Build muscle.
- AI needs `CLAUDE_API_KEY` and/or `GEMINI_API_KEY` in `.env` (Claude first, Gemini
  fallback). Without keys, "Generate my plan" shows "AI plan generation is temporarily
  unavailable (quota or network) — try again later" — expected locally.
- Running wizard, 4 steps: About you (profile summary; "incomplete" hint links to
  Profile) → Running background (PBs, weekly km, longest run, days/week 2–7, injuries)
  → Your goal ("Just start running": 6/8/12 weeks; "Train for a race": distance, race
  date, goal time + **Suggest** from PBs) → Watch data → "Your plan is ready." and back
  to My programs.
- Watch data (optional, 3.3d): pick up to 3 .fit/.gpx files → "Parse files" → toast "2
  runs parsed." (or "…; skipped — <file>: could not parse (use .fit or .gpx exports)." /
  "<file>: larger than 4MB"), a line per run ("2026-09-20: 5.01km · 27.1min · 152 bpm")
  and "N uploaded runs will inform your paces." Nothing is stored; a failed re-parse keeps
  the last parsed runs. Sample files: `testdata/activity/` (runs under 200 m or 60 s, and
  corrupt files, are rejected).
- Validation (legacy copy): "Pick your race distance", "Enter the race distance in km
  (1-500)", "Pick your race date", "Race must be at least 4 weeks away for a useful
  plan", "Pick 2-7 training days per week"; strength: "Pick 2-6 training days per week".
- Build muscle: goal, experience, equipment, days/week (2–6), length (8/10/12 weeks).
- A new plan replaces only the **same-discipline** active plan (running and muscle
  plans coexist). Generation is rate limited (a burst of 3, then one per 20 s).
- Coach mode: `/training/new?student=<trainee id>` titles the page "… for <name>" and
  saves the plan to the trainee ("By your coach" on their card); a non-coach or a coach
  without an active relationship is sent away.

**Rewrite stack — weekly check-in (3.3c)**: the program card's "Week N review ready" →
"Start check-in" opens `/training/checkin?plan=<id>` (it takes a few seconds: the AI
rewrites next week).
- Stat cards: Adherence % (ember under 50%), Sessions done/planned (meal notes don't
  count), Planned km, Actual km (a logged distance wins over the planned one).
- "Flagged sessions": red flags (red) then cautions — flagged session-log notes, and for
  week 3+ "<lift>: same load 3 weeks running — consider a deload or variation".
- Decision (FORMULAS.md §7): a red flag → Deload; under 50% twice in a row → Deload;
  under 50% once → Repeat the week; otherwise Advance (+ "Heads up: N sessions flagged
  for caution."). The reasons are listed.
- "Proposed week N+1": the AI summary, or without AI "Keeping week N+1 as planned.
  <reasons>" with the week unchanged.
- "Confirm — update week N+1 (+20 XP)" → toast "Week N+1 updated · +20 XP", back to My
  programs, banner gone; **only that week's items change**. Opening the check-in link
  again (or for a week 1 plan, the last week, another user's plan) goes back to
  `/training`.
- Checking in late replaces the new week's items — including ones already done or logged
  that week (as before).

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

**Rewrite stack** (Today is ported, with the "Today's meals" card — journey 5, step 10;
the goal strip — journey 9; coaching card and group nudge arrive with their modules; the daily stack is journey 5, steps 5–7):
- Header shows the date, "Hi, <first name>", the streak badge, and initials. Level
  ring + XP bar, hearts ("N hearts · a missed day costs one"), and (desktop) the
  Level / Streak / Total XP / League stat row.
- Opening Today settles the streak for past days first: a missed required day spends
  a heart (streak frozen); with 0 hearts the streak resets and hearts refill to 3.
- "Log it" → toast "+N XP earned", the card turns into the reward state (XP, next
  streak) with confetti, and "x of y done" updates. **A sport can be logged once per
  day** — a second log (e.g. from another tab) is refused ("Already logged today —
  nice work."); two sessions of the same sport on one day both show done.
- Plan item toggle: done → "+60/+30/+20 XP earned" (by type), undo → "Undone · -N XP";
  done → undo → done nets the XP once. The API refuses "done" outside the item's day
  and the day after, even if the button were forced.
- A done run/strength item shows "Log details": effort (RPE 1–10, tap again to clear),
  run distance / duration / avg HR or the per-set strength editor (prefilled from the
  prescription, max 20 exercises × 10 sets, blank weight = bodyweight), and a note.
  "Save log" → toast "Session logged · +10 XP" (+ " You lifted N kg total — that's a
  <thing> 🐎." with confetti when weights were entered) + " 🏃 <AI coach comment>"; the
  row then shows the stat and the comment (amber for caution, red for a red flag). Without
  AI there is no comment unless the note mentions pain / RPE ≥ 9 — then "Your note was
  flagged — take it easy and monitor how it feels." is stored so the check-in sees it.
  Logging the item again (e.g. after a reload) → "Session already logged".
- 2+ run/strength items today show "2 intense workouts today — consider spacing them."
- No plan → "Train for a marathon" card; with plans → "Training plan(s) · n items today".
- Weekly targets show as "This week" chips; a progress-photo link appears when you've
  been active and have no progress photo in 28 days.
- The Nutrition tab shows a placeholder until that module lands.

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

**Rewrite stack — Calendar (3.4, meal line 3.5c)**: steps 1–4 as above.
- Header: "Edit routine" → My week, "Manage programs" → `/training`.
- "Prev" / "Next" move a week (`/calendar?week=<Monday>`); the label reads
  "Sep 21 – Sep 27 · this week" on the current week. A bad `?week=` shows this week.
- "Weekly targets" chips score the **viewed** week's completed logs (hidden without
  targets).
- Each day lists routine sessions active that date (respecting "repeat until" and start
  dates; struck through once that sport is logged that day, "routine" tag) and every
  active plan's items for that date — two plans can sit on one day, each in its own
  week — or "Rest". A done plan item is struck through.
- Marking a plan item done/undone on Today (or logging a session) is reflected on the
  calendar right away.

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
7. **Rewrite stack**: the Daily stack card is on Today. Toasts: "<name> added to your
   daily stack.", "Schedule updated.", "Removed."; the check toggles instantly (no
   toast) and survives a reload. **Editing a schedule now really saves** (legacy
   silently kept the old one). Max 20 supplements ("Keep the stack under 20 items");
   names are cut to 60 characters, doses to 40. Removing a supplement also removes
   its logs.
8. **Rewrite stack — meal logging (3.5a)**: `/nutrition` (the Meals tab).
   - "Today" card: "787 / 2,000 kcal" with a progress bar when a calorie-intake goal is
     active (otherwise the "Set a daily calorie-intake goal…" hint), then protein · carbs
     · fat and sugar · fiber · sodium lines.
   - Logger: meal-type chips (Breakfast / Lunch / Dinner / Snack) and Search / Manual.
     Search matches the food list as you type (2+ letters; `%` and `_` are literal);
     "Search USDA database" appears only when `USDA_API_KEY` is set, and asks USDA
     only on click (rate limited). Pick a food → amount + unit (g, ml, tsp, tbsp, cup,
     oz, slice, piece, handful, serving → grams, e.g. 0.5 cup = 120 g) → Log.
     Manual: food, kcal (1–5000), optional protein.
   - Toasts: "Meal logged · +5 XP." for the first 3 meals of a day, then "Meal logged ·
     daily meal XP cap reached."; the first log after a day within ±10% of the goal with
     2+ meals adds " · +30 XP for hitting yesterday's calorie goal".
   - Errors (legacy copy): "Enter the amount in grams", "Name the food or pick one from
     search", "Enter the calories (1-5000)", "Food not found".
   - Meals list by type with each group's kcal; ✕ removes a meal: "Meal removed · -5
     XP." when it had earned XP (**new**: the XP is given back, so delete + re-log can't
     farm past 15 meal XP a day). Empty day: "Nothing logged today".
   - Trends (once anything is logged): "This week" avg kcal with 7 daily bars (brand
     when the goal was hit, dashed goal line) and "This month" — averages over logged
     days only, "N of 7/30 days logged".
   - A USDA pick is re-read from USDA by the API and stored once in the food list.
9. **Rewrite stack — photo logging (3.5b)**: Photo tab → optional hint → "Snap or choose
   meal photos" (up to 3; they're shrunk to ≤1600 px JPEG on the phone first) →
   "Estimating…" → toast "Estimate ready — review and adjust before saving." → a row per
   food (name, grams, kcal — all editable, ✕ to drop), "Add item" searches a food and
   adds it by amount + unit, "Total N kcal" → "Save N items" → "N items logged · +X
   XP." (meal XP per row, 3 a day) or "Discard". Nothing is saved before Save. Without AI
   keys: "AI estimation is temporarily unavailable — try again later"; a non-food photo:
   "Couldn't recognize food in that photo — try another angle". Photo-logged meals show
   a camera icon in the list.
10. **Rewrite stack — AI meal plan (3.5c)**: Meals tab → "Meal plan" pill → `/nutrition/plan`.
    - Without a plan: the wizard — goal chips (Lose fat / Maintain / Gain muscle /
      Recomp), Diet (omnivore … keto), Meals / day (3 or 4), allergies and foods to
      avoid (comma-separated). Without a training plan a dismissible hint links to
      "build a training plan first".
    - "Generate meal plan" → "Generating your week…" → "Meal plan ready — your calorie
      goal is set to match." Without height, weight, and birth date on the profile:
      "Add your height, weight, and birth date on your profile so we can size your
      targets." (nothing saved). AI down: "AI is temporarily
      unavailable — try again later". Generating is rate limited (3 quick tries, then
      one every 20 s).
    - The plan: "Daily target" kcal with protein · carbs · fat, then Mon → Sun, each meal
      with type, title, kcal, macros, "Recipe & ingredients" (expands) and "Watch how"
      (YouTube search); a "Grocery list" with ×counts; "Regenerate" (same answers, a new
      week) and "Discard" ("Meal plan discarded." → back to the wizard; the calorie goal
      stays).
    - The Meals tab's "Today" card now reads "… / <target> kcal".
    - Today shows **"Today's meals"** (today's weekday; "N kcal planned · target X";
      "Full meal plan" link, or "Nothing planned for today — see the full plan for the
      week.") and each calendar day ends with "N meals planned · X kcal" plus the
      adherence line on today/past days. Both disappear after Discard.

### 6. Coaching

1. Coach generates an invite code (per sport); trainee redeems it (while
   community is disabled: Profile → "My coach" section) → appears on the
   roster with level, weekly XP, and the 7-dot adherence strip.
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

1. Profile → **Body tab → Watch data** → upload .fit/.gpx exports (≤3 files) → parsed
   runs listed (date · km · min) → "Log N runs" saves them as completed
   workouts with XP (60 × running multiplier each) and they appear on the
   calendar.
2. Rules to verify (FORMULAS.md §14): runs older than **14 days** or in the
   future are skipped; a date that already has a logged run is skipped;
   **re-importing the same file imports nothing** (no double XP).
3. **Rewrite stack (3.6b)**: Profile → Body → Watch data → "Choose files" (up to 3) →
   "N runs parsed." and a line per run ("2026-09-23: 5.34km · 30min · 151 bpm", FIT/GPX)
   → "Log N runs" → "Imported 1 run · +60 XP · 1 skipped (already logged or older than
   14 days)"; the list clears. Nothing importable: "Those days already have a logged run"
   or "Only runs from the last 14 days can be imported" (the list stays). Imported runs
   show on the calendar as "logged", tick the routine, and appear in Recent XP as
   "Running workout".

### 8. Share cards & progress (Profile + logging surfaces)

1. **Share cards**: after logging a strength session with weights, "Share
   it" opens a preview sheet — Story/Square formats, optional photo, Share
   (native share sheet on mobile) or Save image on desktop. Same sheet from
   the nutrition day summary ("Share today") and each meal row's share icon.
   Verify: the "coachin" watermark is always on the image; **body weight
   never appears on a card**; nothing posts anywhere without the OS share
   sheet or an explicit save.
2. **Progress photos** (Profile → Progress tab): add photos (they're
   re-encoded — EXIF/location stripped — and AI-screened; reports are
   rejected here), max 24; Compare → pick two → oldest shows left →
   "Share progress" builds a two-photo card after an explicit consent note.
   Dashboard shows a quiet "add a progress photo" hint for active users
   after 28+ days without one.
3. **Progress charts** (Profile → Progress tab): weekly volume bars, weekly km,
   body-weight trend (needs ≥2 measurements), and top-set trends for
   exercises logged ≥3 times. Charts hide individually without data; an
   explainer shows when everything is empty. Values must match the raw logs.

### 9. Profile & goals (rewrite stack, 3.6a)

1. Header on every tab: avatar in a level-progress ring, name, "email · joined
   <Month Year>", Level / tier / "N days" streak chips; "Log out" on desktop (Settings on
   phones). Tabs: Overview · Progress · Body · Settings (`?tab=`; unknown → Overview).
2. **Overview**: Total XP · Streak · Best streak · Workouts (completed logs), the hearts
   line ("N of 3 hearts."), Goals, Training links (My programs, Recurring routine),
   Recent XP (5 newest ledger rows: "Running workout", "Streak bonus", "Meal log",
   "Meal log undo -5", "Goal achieved +200" — no ids in labels).
3. **Goals**: "No goals yet" → pick a metric (only types without an active goal), target,
   optional date → "Goal created."; a second active goal of a type is refused ("You
   already have an active weight goal"). Weight / body fat show "75kg now · 50% there ·
   by Dec 31" and a bar; untracked types show a hint ("Tracking arrives once runs carry
   distance."). Remove → confirm → "Goal removed." (no XP). Achieved goals show as green
   trophy badges (3 newest).
4. **Goal payout** (FORMULAS §6): a weight goal set **before any measurement** takes the
   next reading as its start and pays nothing; a goal set after a reading starts from it.
   Crossing the target pays **+200 XP once**: "Goal achieved: Weight 70kg! +200 XP" plus
   confetti; the goal moves to the badges.
5. **Progress**: charts (weekly volume, weekly km, body weight with 2+ measurements, top
   sets for exercises on 3+ days) or the "Charts appear here…" explainer; Measurements:
   weight (30–300) and/or body fat (3–60) → "Measurement logged." ("Enter a weight or a
   body fat percentage" when both blank); the last 6 readings with ✕ to delete
   ("Measurement deleted."). Two readings on one day chart in the order logged.
6. **Body**: birth date (age 10–120: "Enter a valid birth date"), sex, height (100–250),
   country (56 chars), training history (2,000 chars) → "Profile updated." Blank fields
   clear. These feed the AI training and meal plans (the meal plan's "Add your height,
   weight, and birth date…" error is fixed here plus a Progress measurement).
7. **Settings**: Theme, "Share nutrition with my coach" (Turn on → "Your coach can now see
   your nutrition."; Turn off → "Nutrition sharing turned off."), Password.
8. **Today**: with a tracked goal, a strip "Weight goal · 74.6kg → 72kg" + bar (the goal
   closest to done) links to the profile.

## Gamification rules QA must know

All from [`FORMULAS.md`](FORMULAS.md) — spot-check against it, not intuition:

- XP: routine workout log = 60 × sport multiplier; plan-item completion is a
  fixed per-type amount; session-log detail = fixed +10 (idempotent); meal
  logging and daily calorie adherence have their own fixed awards.
- Levels: every 1000 XP. Streaks count **days**, driven by fixed-session
  required days; hearts absorb missed required days.
- Goals: reaching a weight / body-fat target pays +200 XP once; a goal without a start
  takes the next reading as its baseline (never pays on it).
- Weekly targets (quotas), strength **total volume**, and **supplements**
  are informational / celebration only — they never move XP, streaks,
  hearts, or tiers.

## Running the app locally

**Rewrite stack (`feat/backend-rewrite-with-go`)**: Docker only — `make up`, then
`make seed`, open http://localhost:8080. See the root [`README.md`](README.md).

**Legacy app (`main` / `develop`)**:

```bash
pnpm install
pnpm dev            # Next.js dev server on :3000
pnpm test           # vitest unit suite
pnpm storybook      # component workbench on :6006
```

- Env: `.env.local` needs the Supabase URL/key plus AI keys (Gemini /
  Anthropic; USDA key for food search). Ask a developer for a filled file —
  there is no `.env.example` yet.
- Database: Supabase migrations live in `legacy/supabase/migrations/` and are
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
one active plan per discipline; quotas/volume having no XP effect;
**community is disabled on purpose** (nav item hidden, /community redirects
to the dashboard, user discovery API returns 404, and social mutations —
clubs, follows, groups — are rejected server-side even if invoked directly;
coach invite codes and plan assignment still work — behind a feature flag,
not removed).
