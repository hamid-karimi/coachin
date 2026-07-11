# Work log

Running journal for session continuity. Newest entry first. Each entry: date ·
branch · what was done · decisions · next steps. Rules in `CLAUDE.md` § Work log.

---

## 2026-07-10 (later) · `feat/profile-login-redesign`

**Done**:

- `fce8864` sidebar: sticky + h-dvh (exactly one viewport tall, scrolls
  internally — no longer stretches to page height) + profile page split into
  four `?tab=` server-rendered tabs (ProfileTabs pill nav, CommunityTabs
  pattern): Overview (stats/hearts/goals/training links/recent XP),
  Progress (charts/measurements/progress photos), Body (body profile/body
  photos/watch import), Settings (theme/nutrition sharing/my coach/logout).
  Heavy fetches (photo URL signing, 12-wk session logs, XP feed, goals) are
  tab-scoped now.
- Login/register brand panel: static copy → `FeatureSlideshow`
  (app/auth/components) — 5 text+icon slides (~5s, hover-pauses, dot nav,
  carousel a11y). Decision: text + lucide icons over screenshots — nothing
  to re-shoot when UI changes, always token-themed.

**Next**: ⚠ the slideshow/auth + docs changes are IN THE WORKING TREE but
NOT yet committed (a temporary harness outage blocked shell commands after
tsc+eslint passed). Resume with: `pnpm test && pnpm build`, then commit as
"feat(auth): what-the-system-does slideshow on the login brand panel", then
push + PR → develop (no migrations); eyeball the slideshow and tab flows on
the Vercel preview.

## 2026-07-10 · `fix/logout-and-community-flag`

**Done**:

- `752f6b7` fix(auth): logout 500 (digest 2304524774). Root cause:
  `logoutAction` did `revalidatePath("/", "layout")` before redirecting →
  Next re-rendered the CURRENT page (/profile) mid-logout with a
  half-cleared session → profile page's `throw` on failed profile fetch.
  Fix: drop the revalidation (authed pages are dynamic) + profile/dashboard
  now redirect to /auth/login instead of throwing on profile-fetch failure.
- Community kill-switch: `lib/feature-flags.ts` `isCommunityEnabled()`
  (NEXT_PUBLIC_FEATURE_COMMUNITY === "on"; default OFF). Gates: /community
  layout redirect, discover API 404, Community nav item (bottom-nav +
  sidebar), dashboard group-streak nudge. AddCoachByCodeForm surfaces on
  /profile ("My coach") while off so trainees can still join a coach.
  NOTHING deleted — re-enable = set the env var + redeploy.

**Next steps**: push + PR → develop; verify logout on Vercel (was
production-only symptom); QA journey 6 step 1 changed (invite redemption on
profile while community is off).

## 2026-07-09 (later) · `feat/share-progress` — BUILT (3 phases committed)

Plan: `plans/share-progress-plan.md`. All three phases implemented:

1. **Share cards** (`3300d8d`): `lib/share-card.ts` (pure builders, privacy
   rules: no body weight, additive stats only) + canvas renderer
   (`components/share/share-card-canvas.ts`, story/square, watermark always
   on) + `ShareCardSheet` (preview, photo picker, Web Share API/download).
   Entry points: strength-log success ("Share it"), nutrition day summary
   ("Share today"), meal rows.
2. **Progress photos** (`67912d3`): migration `20260709150000` ('progress'
   kind + per-kind cap trigger: body_photo 5, progress 24);
   `uploadProgressPhotoAction` reuses sharp+moderation pipeline; profile
   timeline/compare/share section; 28-day dashboard nudge.
3. **Progress charts**: `lib/progress-charts.ts` (weeklyVolume, weeklyKm,
   exerciseTopSets, weightSeries — pure + tested), design-system
   `WeeklyBarsChart`/`TrendLineChart` (SVG, no lib, stories), profile
   "Progress" section fed by last-12-week session_logs.

**Next steps**: push branch + PR → develop; apply migration
`20260709150000_progress_photos.sql` to hosted Supabase; QA journey 8.
Parked: AI caption suggestions on share cards; weekly-recap share card
(needs the recap feature from the joy brainstorm below).

## 2026-07-09 (later) · brainstorm — joy/consistency engine (no code yet)

Deep-dive on using collected data for 30s/40s starters. Diagnosis: log-moment
dopamine is strong (confetti/XP/volume); missing layer is serotonin — proof,
forgiveness, being seen. Converged ranking (joy ÷ effort):

1. **PR detection** at save from session_logs.actual per-set history (days).
2. **"Your week" recap card** on dashboard (scorecard math exists; shareable
   image later; no push channel yet — v1 is seen-on-next-visit).
3. **Fresh-start/comeback mode**: ≥6 idle days → one auto-shrunk week +
   streak rebuild quest (reuse deload machinery; forgiveness > punishment).
4. **Coach high-five** on logs + coach at-risk flag with drafted message.
5. **Then-vs-now** monthly + lifetime milestones (reuse equivalence table,
   localized landmarks).

Medium-term differentiator: **self-evidence engine** (RPE-at-same-weight
trend, pace-at-HR trend, adherence↔effort correlations; honest wording,
min-data thresholds). Also: capture the user's "why" at onboarding and echo
it in AI feedback/recaps. Guardrails agreed: NO XP on any of these; never
celebrate scale weight in shareables by default.

## 2026-07-09 · `feat/adherence-supplements`

**Done** (plan: `plans/adherence-supplements-plan.md`, phases A→B→C):

- **Supplement schedules** (A): `schedule_type` + `days_of_week` on
  `supplements` (migration `20260709120000`); `lib/supplement-schedule.ts`
  (`isSupplementDue`, `scheduleLabel`, pure + tested). Dashboard checklist +
  tally show only due-today; manage sheet adds a schedule picker + inline
  editor (`updateSupplementScheduleAction`). training_days degrades to daily
  only when the user has NO training structure (dashboard derives it from
  today's plan/routine + a schedules-existence count).
- **Coach stack visibility** (B): migration `20260709130000` mirrors the
  nutrition coach-read RLS onto `supplements` + `supplement_logs` (SELECT,
  gated on `nutrition_sharing_enabled`). `getTraineeSupplements` +
  `lib/supplement-adherence.ts` compute a 7-day "N/M due days" rate (reads the
  trainee's plan/plan_items/schedules — all coach-readable). Read-only
  `TraineeSupplementsSection` on the coach nutrition page.
- **Meal adherence** (C): `lib/meal-adherence.ts` (pure + tested) — slots
  match on `meal_type`, kcal ratio vs plan. Calendar shows a muted line on
  today/past cells only, when an active plan exists (`day-meals-line.tsx`);
  future days keep the plain planned link.
- Docs: FORMULAS §13 (schedules, coach read, new Meal-adherence subsection),
  QA journeys 4/5/6, dashboard/calendar/coaching/nutrition READMEs.

**Decisions**: no new XP anywhere (adherence + supplements stay
informational, FORMULAS §13); meal adherence deliberately does NOT string-match
logs to AI dish titles (slots + kcal only); reused `nutrition_sharing_enabled`
for the coach stack view (no new consent flag); schedules have no times-of-day
/ notifications (dose free-text carries timing).

**Verification**: tsc · eslint · 197 tests · `pnpm build` all green. Commits
on `feat/adherence-supplements`: A `ad0660b`, B `18f15f6`, C `bfe1b83`, plus
this docs commit.

**Next steps**

- [ ] Push `feat/adherence-supplements`, open PR → develop.
- [ ] Apply migrations `20260709120000_supplement_schedules.sql` +
      `20260709130000_supplements_coach_read.sql` to hosted Supabase after
      merge.
- [ ] QA per updated journeys 4 (calendar adherence), 5 (schedules /
      due-only checklist), 6 (coach Daily stack).

## 2026-07-09 · `feat/nutrition-integrations`

**Done** (plan: `plans/nutrition-integrations-plan.md`):

- Multi-photo meal recognition: up to 3 photos of the same meal + optional
  context hint; prompt merges angles/label shots, prefers label data
  (`lib/ai/nutrition.ts`, `estimateMealPhotoAction`, meal-logger UI).
- Locale-aware nutrition: `profiles.country` column (migration
  `20260709090000`), Country field on the profile body form,
  `lib/user-country.ts` (profile wins over `x-vercel-ip-country` header),
  country injected into meal-plan + photo prompts. No AI price quoting.
- Watch-file import on Profile: "Watch data" section reuses the GPX/FIT
  parser; `importActivitiesAction` logs completed runs — 14-day window,
  one per sport×date dedup, XP = 60×multiplier (FORMULAS §14;
  `lib/activity-import.ts` pure + tested).
- Docs: FORMULAS §14, QA-ONBOARDING journeys 5+7, nutrition README.
- Committed `9a61011` (watch import + docs) after full verification
  (tsc · eslint · 179 tests · production build all green); branch pushed
  to origin.

**Decisions**: Iran first locale (user-set country, IP fallback); watch
import capped to 14 days to prevent bulk XP farming; Strava = spec only in
the plan file (Phase 4) until Hamid registers the API app; Apple/Samsung
Health parked for the future React Native/Flutter app.

**Next steps**

- [ ] Open PR → develop (gh CLI unauthenticated in-session; use
      https://github.com/hamid-karimi/coachin/compare/develop...feat/nutrition-integrations
      — draft PR body in session notes), then apply migrations
      `20260709090000_profile_country.sql` (+ `20260708090000_supplements.sql`
      if not yet applied) to hosted Supabase after merge.
- [x] ~~Strava API app~~ — PARKED: Strava now paywalls API access behind a
      subscription, and Hamid's account can't even open the subscription
      page ("no access" — likely region/payment restriction). Watch-file
      import covers the use case; spec kept in the plan file if this ever
      unblocks.
- [ ] QA the three features on Vercel per QA-ONBOARDING journeys 5 and 7.

## 2026-07-08 · `feat/meal-plan-surfacing-supplements`

**Done** (commit `1cfced7`, + docs/process commit after it):

- Dashboard "Today's meals" card: today's menu from the active AI meal plan
  (kcal vs target) linking to `/nutrition/plan`; hidden without an active plan.
- Calendar: per-day "N meals planned · X kcal" link on every day cell.
- Shared loader `app/nutrition/lib/meal-plan-day.ts` (weekday-keyed menu).
- "Daily stack" supplements habit: `supplements` + `supplement_logs` tables
  (migration `20260708090000_supplements.sql`, self-only RLS, unique per
  supplement per day), dashboard checklist card with add/delete manage sheet.
- Process: CLAUDE.md gained the QA-doc rule and this work-log rule;
  QA-ONBOARDING.md updated for meal-plan surfacing + supplements.

**Decisions**

- Supplements award **no XP/streaks/hearts** (FORMULAS.md §13) — too easy to
  fake-log; revisit as a card-local streak if the habit sticks.
- Calendar shows a meals *link*, not full meals — menu repeats weekly, cells
  stay training-first.
- "Reminder" = presence on Today with a pending count; push notifications are
  out of scope (no infra).

**Next steps**

- [ ] Push `feat/meal-plan-surfacing-supplements` and open PR → `develop`.
- [ ] Apply migration `20260708090000_supplements.sql` to hosted Supabase
      after merge.
- [ ] Deploy to Vercel (guide in progress — see session notes; env vars:
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      GEMINI_API_KEY, CLAUDE_API_KEY, USDA_API_KEY; do NOT copy
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY — unused in code and unsafe with
      the NEXT_PUBLIC_ prefix; remove/rotate it).
- Ideas parked: per-date meal adherence on calendar; supplement schedules
  (times / training-days-only); coach visibility of the supplement stack.

**Ideas brainstormed 2026-07-09 (not yet specced)** — agreed order:

1. Multi-photo meal recognition (up to 3 angles + optional packaging shot +
   context text field; Gemini takes multiple images in one request) — days.
2. Locale-aware nutrition: country/food-culture/budget in profile → into the
   meal-plan AND photo-recognition prompts ("ingredients affordable in X,
   local dishes"); NO AI price quoting. Prompt-level MVP before any local
   food-DB investment — days.
3. Strava integration (OAuth + webhooks): auto-import watch activities →
   same logging path as manual logs. HARD PART: dedup/XP integrity
   (external_activities table, provider-id idempotency, plan-item matching,
   imported activities count toward streaks). Needs a plan file first.
   Apple Health/Samsung Health need NATIVE apps (no web API) — parked until
   a mobile decision; aggregator APIs (Terra/Rook) as middle option.

Open questions for Hamid: register a Strava API app? Which country first
for locale-aware food? Native mobile app in the 12-month picture?

## 2026-07-07 · `feat/ranked-improvements` (merged → develop as PR #48)

**Done** — six phases, plan in `plans/ranked-improvements-plan.md`:

1. Short plan-item titles + `plan_items.description` (+ backfill migration).
2. Calendar routine rows tappable → "Log it on Today" sheet.
3. Onboarding add-commitment: 2-step bottom sheet, always-enabled Add with
   pointing validation, 12 new sports seeded.
4. Hevy-style per-set logging (`lib/workout-sets.ts`), total-volume
   celebration ("that's a small car 🚗"), volume NOT in XP (FORMULAS §12).
5. Coach arc: coach generates AI plans for trainees
   (`/training/new?student=<id>`, `created_by`, RPC relationship check) +
   trainee opt-in nutrition sharing (RLS) + coach 7-day nutrition view.
6. `QA-ONBOARDING.md` + README/FORMULAS updates.

**Decisions**: coach plans apply directly (no trainee acceptance); diet
sharing = full log access, opt-in, revocable; QA deliverable = markdown doc.

**State**: merged; migrations `20260707120000/121000/130000/131000` applied
to hosted Supabase by Hamid.
