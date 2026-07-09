# Work log

Running journal for session continuity. Newest entry first. Each entry: date ·
branch · what was done · decisions · next steps. Rules in `CLAUDE.md` § Work log.

---

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
