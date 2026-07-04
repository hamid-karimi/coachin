# Features Roadmap — Profile · Goals · Marathon AI · Nutrition · Group Boards

Five features, five branches, shipped in dependency order. Each branch comes off
`develop` and PRs back to `develop`. Decisions already locked with the user:

- **Order:** Profile → Goals → Marathon AI → Nutrition/Calories → Group boards,
  **one branch per feature**.
- **Group XP mechanic:** streak-freeze + growing bonus (no collective punishment).
  Everyone always keeps their own XP; the group shares a streak that grows and
  pays a bonus only on days when every member trained; a skipper freezes (not
  resets) the streak.
- **Food XP:** flat XP for logging meals (habit, capped/day) + bonus for daily
  calorie-goal adherence. No "healthiness" scoring.
- **Run data v1:** manual PBs + optional GPX/FIT file upload with instructions.
  Strava OAuth is a fast-follow, NOT in v1.
- **AI provider: Google Gemini API** (free tier). One provider covers both the
  marathon-plan generation (structured JSON output) and food-photo calorie
  estimation (vision). Corroboration: this machine's tooling already calls
  `gemini-3-flash-preview` via `GEMINI_API_KEY`. NVIDIA NIM rejected: free
  credits expire, vision coverage weaker, no advantage.

## Cross-cutting Phase 0 — verification gates (run on EACH branch before coding)

External facts MUST be re-verified against live docs at build time (research
agents were cut off; treat the following as high-confidence but unverified):

1. **Gemini** (branches 3 & 4): verify at https://ai.google.dev/gemini-api/docs
   - Current free-tier model id (expect `gemini-3-flash-preview` or
     `gemini-2.5-flash`) and rate limits (RPM/RPD) on the pricing page.
   - SDK package is `@google/genai` (the older `@google/generative-ai` is
     deprecated — do NOT install it).
   - Structured output params: `responseMimeType: "application/json"` +
     `responseSchema` in `generationConfig` — confirm exact names.
   - Vision: image passed as `inlineData: { mimeType, data(base64) }` part.
   - Key stored as `GEMINI_API_KEY` (server-only env; never NEXT_PUBLIC).
2. **Food database** (branch 4): verify USDA FoodData Central
   (https://fdc.nal.usda.gov/api-guide) — free API key, ~1000 req/hr,
   `/v1/foods/search`. Fallback/alternative: Open Food Facts (no key).
   Strategy: seed a local `foods` table for fast autocomplete; live API only to
   backfill misses.
3. **FIT parsing** (branch 3): verify npm `@garmin/fitsdk` (official Garmin FIT
   JS SDK) name + decode usage; GPX is plain XML (parse with `fast-xml-parser`).
4. **Strava** (fast-follow only, NOT v1): before building, re-read Strava API
   terms — they added AI/data-use restrictions; sending Strava data to Gemini
   may be prohibited. This is a legal gate, not just technical.

Codebase facts (verified this session, `develop` @ post-#21):
- `profiles` has NO body metrics (no age/sex/weight/height) — branch 1 adds them.
- `daily_plans` exists (user_id, date, content text, is_completed, feedback) —
  reusable for marathon plan days.
- XP flows through `xp_transactions` + `profiles.xp`; `logs` records workouts;
  `lib/xp.ts` `levelProgress`; server-action pattern:
  `useActionState` + `useActionToast` + RPCs for atomic ops.
- DS components (Volt & Ember, post-#21): `AppShell(coachNav?)`, `StatCard`
  (accents incl. `gold`), `XpBar(totalXp?)`, `StreakBadge(compact?)`,
  `TierBadge`, `LeaderboardRow(subtitle?, highlight?)`,
  `SportChip(multiplier?, selected?)`, `EmptyState`, `ConfirmButton`/dialog,
  `Button` variants incl. `destructive-outline`, `Badge` incl. `success`.
- Roles/nav: `lib/roles.ts` (`homeFor`, `canCoach`), 5-item nav via `coachNav`.
- Every mutation: server action returning `{ error?, success?, message?, status? }`.

Global anti-patterns (all branches):
- ❌ Calling Gemini from client components (key leak) — server actions/route
  handlers only.
- ❌ Trusting AI output shapes — always validate the JSON against a zod schema
  before persisting; store the raw response for debugging.
- ❌ Awarding XP client-side — XP mutations go through a SECURITY DEFINER RPC
  like existing atomic ops (`20260214111000_add_atomic_operations.sql`).
- ❌ New tables without RLS + policies in the same migration.
- ❌ UI copy: users are "trainees" (never "students"); English-only messages.

---

## Branch 1 — `feat/profile` (foundation)

Adds body metrics + a real `/profile` page. Feature 4 of the user's list, but
it's the dependency for goals + marathon intake, so it ships first.

**Migration** `profiles_body_metrics.sql`
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS`: `birth_date date`,
  `sex text CHECK (sex IN ('male','female','other'))` (nullable),
  `height_cm numeric(5,1)`, `weight_kg numeric(5,2)`, `body_fat_pct numeric(4,1)`,
  `training_history text`, `preferred_units text DEFAULT 'metric'`.
- New table `body_measurements` (id, user_id FK, measured_at date,
  weight_kg, body_fat_pct, created_at) + RLS self-only policies — weight over
  time is a series, `profiles` holds only the latest snapshot.
- Existing update policy `profiles_update_self` already covers the new columns.

**App**
- `app/profile/page.tsx` (server, AppShell): identity card (avatar initials,
  name, league tier), stat row (Level/Streak/Total XP/League — copy dashboard
  pattern), body-metrics form, measurement history list, theme note, logout.
- `app/profile/actions.ts`: `updateProfileAction`, `addMeasurementAction`
  (insert into `body_measurements` AND update `profiles.weight_kg/body_fat_pct`
  snapshot in one flow).
- Nav: point the existing Profile item at `/profile` (today it TODOs to
  `/dashboard`): `routeFor`/`keyFromPath` in `app-sidebar.tsx`; add
  `/profile/:path*` to `proxy.ts` matcher + unauth redirect; `homeFor` unchanged.
- Age is DERIVED from `birth_date` — never store age.

**Verify:** build; `/profile` route listed; unauth → login; edit persists after
reload; measurement insert updates both table and snapshot; nav highlights.

---

## Branch 2 — `feat/goals`

**Migration** `goals.sql`
- `goals`: id, user_id FK, `goal_type text CHECK (goal_type IN ('weight',
  'calorie_intake','calories_burned','weekly_run_km','monthly_run_km',
  'body_fat_pct'))`, `target_value numeric`, `start_value numeric`,
  `target_date date`, `status text DEFAULT 'active' CHECK (status IN
  ('active','achieved','abandoned'))`, timestamps. RLS self-only.
  Partial unique index: one ACTIVE goal per type per user.

**App**
- `lib/goals.ts`: `goalProgress(goal, current)` → pct + direction (weight loss
  counts DOWN — handle target < start); current values come from:
  weight/body-fat → latest `body_measurements`; run-km → sum of `logs` joined
  to running sport this week/month (distance not tracked yet → v1 counts
  sessions×planned; note as limitation); calories → branch 4 data (goal types
  exist now, progress wiring lands with branch 4).
- `app/goals/` or profile section (recommend: goals card on `/profile` + a
  compact "active goal" strip on the dashboard): create/edit/abandon goal
  (ConfirmButton for abandon), progress bar per goal (`Progress` + StatCard).
- XP: `achieve_goal` RPC — when progress crosses 100%, mark `achieved`, award
  bonus XP (e.g. 200) via `xp_transactions` + `profiles.xp` atomically; fire
  confetti client-side on the transition (copy dashboard confetti pattern).

**Verify:** build; create each goal type; progress math correct for
down-direction goals; achieving awards XP exactly once (idempotent RPC).

---

## Branch 3 — `feat/marathon-ai`

**Phase 0 gate:** verify Gemini SDK/model/limits (see cross-cutting gates).
Env: `GEMINI_API_KEY` in `.env.local` + Vercel/host env. `pnpm add @google/genai`.

**Migration** `training_plans.sql`
- `training_plans`: id, user_id, `race_date date`, `goal_time interval` (or
  text "3:59:00"), `status ('draft','active','completed','archived')`,
  `intake jsonb` (questionnaire snapshot), `raw_ai_response jsonb`,
  `model text`, timestamps. RLS self-only.
- `plan_items`: id, plan_id FK, `week int`, `day_of_week int (0-6)`,
  `item_type CHECK IN ('run','strength','stretch','recovery','meal_note')`,
  `title text`, `details jsonb` (pace, distance_km, duration_min, meal macros…),
  `is_completed boolean DEFAULT false`. RLS via plan ownership.
  (Do NOT overload `daily_plans` — its `content text` shape is too loose; keep
  it for coach free-form plans.)

**App**
1. `lib/ai/gemini.ts` — thin server-only client: `generateStructured<T>(prompt,
   zodSchema)` → calls Gemini with `responseMimeType: application/json` +
   `responseSchema` derived from zod; validates response with zod; returns
   typed data + raw. Handle 429 with one retry + friendly error.
2. Intake wizard `app/marathon/new/page.tsx` (multi-step client form):
   - Step 1 pre-filled from profile (birth_date→age, sex, weight, height,
     training_history) — editable, writes back to profile.
   - Step 2 running background: PBs for 5k/10k/half/full (optional each),
     current weekly km, longest recent run, days/week available (2–7),
     injuries (free text), race date + goal time (suggest from PBs via
     Riegel formula in `lib/running.ts` — pure function, unit-testable).
   - Step 3 (optional) upload GPX/FIT files (multi-file, ≤10MB): route handler
     parses server-side (`@garmin/fitsdk` for .fit, `fast-xml-parser` for .gpx)
     into {date, distance_km, duration, avg_hr?} summaries → shown for
     confirmation → included in the AI prompt as recent-training evidence.
     Include per-watch export instructions (Garmin Connect / Apple Watch via
     workouts export / Suunto / COROS) in an accordion.
3. `generatePlanAction`: builds the prompt (intake + parsed activity summaries
   + weeks-until-race), asks for a week-by-week plan as JSON matching the
   plan_items schema (runs w/ pace+distance, 2×strength, stretch, recovery,
   daily meal guidance with kcal/macros targets), zod-validates, persists
   plan + items in one transaction (RPC `create_training_plan`).
4. Plan view `app/marathon/page.tsx`: active plan → current week view (7-day
   strip, item cards by type with SportIcon), week navigator, mark-done on
   items (own XP: small per-item award via existing log flow for runs; run
   items ALSO create `schedules`-compatible entries? NO — keep separate; the
   dashboard "Today" section additionally lists today's plan_items via a
   loader union, clearly badged "Marathon plan").
5. Nav: add under Plan section or its own item — recommend `/marathon` linked
   from dashboard card + Plan page; not a new bottom-nav slot (5 max).

**Anti-patterns:** don't let the AI decide XP amounts; don't regenerate over an
active plan without ConfirmButton (archive old); cap prompt size (summarize
uploads, never inline raw file bytes into the prompt).

**Verify:** build; generate with a fake profile → valid plan persisted (zod
passes); malformed AI response → friendly error, nothing persisted; FIT and GPX
sample files parse; wizard resumable (draft intake in `training_plans.intake`).

---

## Branch 4 — `feat/nutrition` (calories + food XP)

**Phase 0 gate:** verify USDA FDC key/endpoints; verify Gemini vision request
shape (same client as branch 3).

**Migration** `nutrition.sql`
- `foods`: id, `name text`, `brand text?`, `kcal_per_100g numeric`,
  `protein_g/carbs_g/fat_g per 100g`, `source ('seed','usda','custom')`,
  `created_by uuid?` (for custom), `search tsvector` (GIN index) — seed ~500
  common generic foods via a seed migration; SELECT for all authenticated,
  INSERT own custom.
- `meal_logs`: id, user_id, `date date`, `meal_type ('breakfast','lunch',
  'dinner','snack')`, `food_id FK?`, `free_text text?`, `quantity_g numeric`,
  `kcal numeric`, `protein_g/carbs_g/fat_g numeric`, `entry_method ('search',
  'photo','manual')`, `photo_estimate jsonb?` (raw AI), timestamps. RLS self.
- RPC `award_meal_xp(p_meal_log_id)` SECURITY DEFINER: +5 XP per logged meal,
  hard cap 3 awards/day (count today's meal-XP xp_transactions with reason
  LIKE 'meal_log%'); idempotent per meal_log id.
- RPC `award_day_adherence(p_date)`: if user has an active `calorie_intake`
  goal AND day total is within ±10% of target AND ≥2 meals logged → +30 XP
  once per day (reason `calorie_goal:<date>`). Called lazily on first load of
  the NEXT day (no cron needed).

**App**
1. Autocomplete logger (`app/nutrition/` + dashboard card "Log a meal"):
   debounced search over local `foods` (`textSearch` on tsvector — copy the
   FriendsSection debounce/AbortController pattern), quantity + meal type,
   live kcal calc, submit via action → `award_meal_xp` toast "+5 XP".
   On zero local hits: "Search USDA" button → route handler proxies FDC
   search, picked item is inserted into `foods (source='usda')` then logged.
   Plus "Create custom food" inline form.
2. Photo flow: upload/camera input → server action sends base64 to Gemini
   vision with a strict JSON schema `{items: [{name, est_quantity_g,
   est_kcal, protein_g, carbs_g, fat_g}], confidence}` → user REVIEWS AND
   EDITS the estimate before saving (AI proposes, human confirms — always) →
   saves as meal_logs rows with `entry_method='photo'`.
3. Day summary: ring/bar of kcal vs goal (`calorie_intake` goal from branch 2)
   on dashboard + `/nutrition` history by day with macro split.
4. Storybook stories for the food row, day-summary ring, photo-review sheet.

**Anti-patterns:** never auto-save AI estimates unreviewed; don't award XP in
the client; don't hit USDA per keystroke (local-first, explicit fallback);
photo uploads never stored unencrypted beyond the request unless user saves
(if storing, Supabase Storage bucket w/ RLS — v1 recommendation: don't store).

**Verify:** build; search "chicken" hits local seed; USDA fallback inserts;
meal XP caps at 3/day (4th log → no XP, no error); adherence bonus fires once;
photo flow works with a test image; all tables have RLS policies.

---

## Branch 5 — `feat/group-boards`

**Migration** `training_groups.sql`
- `training_groups`: id, `name`, `invite_code text UNIQUE` (copy generation
  from club invite RPC), `created_by`, `streak_count int DEFAULT 0`,
  `best_streak int DEFAULT 0`, `last_evaluated_date date`, timestamps.
- `group_members`: group_id, user_id, joined_at, UNIQUE(group_id, user_id);
  cap group size 2–10 (CHECK via trigger or RPC guard).
- `group_days`: group_id, `date`, `all_trained boolean`, UNIQUE(group_id,date)
  — audit trail of evaluated days.
- RLS: members SELECT their groups/members/days; join via RPC only.
- RPCs (SECURITY DEFINER, copy style from club RPCs):
  - `create_training_group(p_name)` → creates + adds creator.
  - `join_training_group(p_invite_code)` → statuses `created|already_member`.
  - `evaluate_group_day(p_group_id, p_date)` — idempotent: a day is "full" if
    EVERY member has ≥1 `logs` row (status completed) on that date.
    Full → `streak_count+1`, insert group_day(all_trained=true), award EACH
    member bonus XP = `LEAST(10 + streak_count * 2, 50)` (reason
    `group_streak:<group_id>:<date>`); not full → freeze: streak unchanged,
    group_day(all_trained=false), no XP. Never resets (v1 mechanic as agreed).
    Called lazily: on group page load, evaluate all un-evaluated days from
    `last_evaluated_date+1` .. yesterday.

**App**
- `/community/groups` segment (5th tab in community layout): my groups list,
  create + join-by-code forms (copy ClubMembershipSection layout), group page:
  member roster w/ today's trained-yet dot, group streak flame + best,
  last-7-days strip (copy adherence strip from coaching hub), in-group weekly
  leaderboard via existing `get_weekly_leaderboard` RPC with member ids.
- Dashboard nudge: if any group day is at risk (you haven't logged today and
  group streak > 0): "Your group's 12-day streak needs you" card.
- Leave group = ConfirmButton (destructive-outline trigger).

**Anti-patterns:** no punitive XP removal — the mechanic is bonus-or-freeze
only; evaluation must be idempotent (UNIQUE(group_id,date) guards double XP);
don't evaluate "today" (only completed days).

**Verify:** build; 2-account manual test: both log → streak+1 and both get
bonus; one skips → streak frozen, no bonus, no loss; reload doesn't double-pay
(idempotency); RLS blocks non-members from group data.

---

## Final phase (every branch)

1. `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm build` + `pnpm build-storybook`.
2. Migration applies on fresh `supabase db reset`; every new table has RLS.
3. Grep guards: no `NEXT_PUBLIC.*GEMINI`, no client-side `xp` mutations,
   no unvalidated `JSON.parse` of AI output.
4. Update README feature list + per-module README.
5. PR to `develop` with phase-by-phase summary.
