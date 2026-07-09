# Nutrition + integrations — execution plan

Branch `feat/nutrition-integrations`. Owner decisions: Iran is the first locale
target (later: per-user country, IP default); mobile app will eventually be
React Native/Flutter (so Apple/Samsung Health waits for that); watch-file
import lives on the Profile page for occasional use; Strava is speced here but
built only after Hamid registers the API app.

Per phase: implement → `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>`
· `pnpm test` → commit. Update QA-ONBOARDING.md + module READMEs + WORKLOG.md
per CLAUDE.md working agreements. FORMULAS.md governs all XP math.

## Phase 0 — discovery (done, inline)

- `generateJsonText` (`lib/ai/text-json.ts:22,70`) already accepts
  `images: {base64, mimeType}[]` — multi-image is a caller change only.
- Photo pipeline: `estimateMealFromPhoto` (`lib/ai/nutrition.ts:27`, single
  base64 + prompt at :33), `estimateMealPhotoAction`
  (`app/nutrition/actions.ts:214`, single `photo` field, 2MB cap),
  `meal-logger.tsx` photo mode (`onPhotoPicked` :132 compresses ONE file via
  `lib/client-image`; input :321 has `capture="environment"` — capture blocks
  gallery multi-select on mobile, must be dropped when `multiple` is added).
- Meal-plan prompt: `lib/ai/meal-plan.ts:46-63`; line 60 "Keep ingredients
  common and affordable." is the locale-injection point.
  `generateMealPlanAction` (`app/nutrition/plan/actions.ts:60`) fetches
  profile at :78 (add `country`); intake type `MealPlanIntake` :10.
- Profile: `updateProfileAction` (`app/profile/actions.ts:31`),
  `BodyMetricsForm` (3-col grid) rendered at `app/profile/page.tsx:308`.
  `profiles` has NO country column.
- Vercel geo: `x-vercel-ip-country` request header (ISO-2, e.g. "IR");
  `Intl.DisplayNames(["en"], {type:"region"}).of("IR")` → "Iran" (no map).
- Watch files: `parseActivitiesAction` (`app/training/actions.ts:56`) — field
  `activities` (≤3 files, 4MB), returns `ActivitySummary[]`
  (`lib/activity-parse.ts:9`: date YYYY-MM-DD UTC, distance_km, duration_min,
  avg_pace_min_km, avg_hr). Nothing persisted.
- Logs/XP: `logs` table (`20260212000000:94`: user_id, date, sport_type_id,
  status, notes). `logWorkout` (`app/dashboard/actions.ts:28`) awards
  `60 × sport.xp_multiplier` and updates profiles.xp/level
  (level = floor(xp/1000)+1). Streak settling (`settleUserStreak`) only
  evaluates un-settled days — back-dated logs do NOT rewrite settled streaks.

## Phase 1 — multi-photo meal recognition

1. `lib/ai/nutrition.ts`: change `estimateMealFromPhoto` to take
   `{ images: {base64, mimeType}[]; context?: string | null; country?: string | null }`.
   Prompt: photos show the SAME meal (angles / packaging or nutrition label);
   merge into ONE item list, no duplicates across photos; prefer label data
   when visible; use `context` ("user says: …") when given. Keep schema.
2. `estimateMealPhotoAction`: `formData.getAll("photos")` (1–3 File, each
   ≤2MB), optional `context` (≤140 chars).
3. `meal-logger.tsx` photo mode: input gains `multiple`, drops `capture`;
   optional context Input ("e.g. restaurant pizza, large"); compress each
   file; helper copy nudges angles + label shot.

Guards: cap 3 images; review-sheet flow unchanged (never auto-save).

## Phase 2 — locale-aware nutrition

1. Migration `20260709090000_profile_country.sql`: `ALTER TABLE profiles ADD
   COLUMN IF NOT EXISTS country text;`
2. `lib/user-country.ts` (pure, tested): `countryNameFromCode(code)` via
   `Intl.DisplayNames` (null on junk), `resolveUserCountry(profileCountry,
   headerCode)` → trimmed profile value first, else decoded header, else null.
3. Profile: `updateProfileAction` saves `country` (≤56 chars);
   `BodyMetricsForm` gains a Country input (free text, placeholder "Iran");
   page passes `profile.country`.
4. Meal plan: action selects `country`, resolves via
   `headers().get("x-vercel-ip-country")` fallback, adds to `MealPlanIntake`;
   prompt line 60 becomes, when country set: "Use ingredients commonly
   available and affordable in {country}; prefer familiar local dishes and
   staples. Do NOT quote prices." (else unchanged line).
5. Photo estimation: same resolved country → `estimateMealFromPhoto`
   (`country` hint: dishes likely from that cuisine).

Guards: no AI price quoting; empty country string stays null; header is a
hint only (profile wins).

## Phase 3 — watch-file import on Profile

1. `app/profile/components/activity-import-section.tsx` (client): file input
   (.fit/.gpx, ≤3) → reuses `parseActivitiesAction` (import from training
   actions) → parsed runs list (date · km · min · pace) → "Log these runs"
   submits `activities_json` to the new action.
2. `importActivitiesAction` (`app/profile/actions.ts`): validate array (shape
   of ActivitySummary, ≤20), keep only dates in the last 14 days (and not
   future); resolve the Running sport type (name ilike '%run%'); fetch that
   sport's completed logs for those dates → skip duplicates (one per
   sport×date, same rule as the dashboard); insert `logs` rows (status
   completed, notes "Imported from watch file — X km"); award
   `60 × xp_multiplier` per inserted row in ONE profiles xp/level update
   (level = floor(xp/1000)+1, same as logWorkout). Message reports
   imported/skipped counts + XP.
3. Profile page: new "Import watch activities" section under Body profile.
4. FORMULAS.md §14: import rule (same 60×multiplier as a routine log, 14-day
   window, one per sport×date, ≤20/upload; settled streak days are never
   rewritten — only un-settled days can benefit).

Guards: never re-award for a date+sport that already has a completed log; no
new XP formula — reuse the routine-log one; parser stays pure.

## Phase 4 — Strava (PARKED 2026-07-09; API is now paywalled)

Strava now requires a paid subscription to create an API application
("The Strava API is available to subscribers"), and Hamid's account gets
"Sorry, you don't have access to this page" on the subscription link —
likely a region/payment restriction. Watch-file import (Phase 3) covers
the device-data use case. Revisit only if the paywall/region situation
changes; the spec below stays valid.

Prereq (Hamid): active Strava subscription with API access, then
strava.com/settings/api → create app → callback domain =
production Vercel domain; env `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
`STRAVA_WEBHOOK_VERIFY_TOKEN` (random string).

Design (build in a later session once creds exist):

- Migration: `external_connections` (user_id, provider 'strava', athlete id,
  access/refresh tokens + expiry, UNIQUE(user_id, provider)) +
  `external_activities` (user_id, provider, provider_activity_id UNIQUE with
  provider, raw jsonb, log_id fk nullable) — self-only RLS; tokens are only
  touched by service-role server code, never the client.
- Routes: `app/api/strava/connect` (redirect to OAuth, scope
  `activity:read_all`), `/callback` (code→token exchange, store connection),
  `/webhook` (GET = subscription echo challenge with verify token; POST =
  activity create events → fetch activity → upsert external_activities →
  import). Token refresh helper on 401/expiry.
- Import path = SAME rules as Phase 3: map Strava sport → sport_types
  (Run/Ride/Swim/WeightTraining…), one completed `logs` row per sport×date
  (skip if exists — including rows just imported manually), 60×multiplier XP,
  `external_activities.log_id` links for idempotency (webhook retries safe).
- UI: Profile "Connections" card — Connect with Strava / Connected as
  <athlete> / Disconnect (deletes tokens; keeps imported logs).
- QA: tampered webhook payloads ignored (verify token + signed athlete
  lookup); duplicate webhook deliveries import once.

## Final — verification

tsc, eslint changed files, pnpm test, pnpm build; QA-ONBOARDING.md journeys
(nutrition photo, profile import), READMEs (nutrition, dashboard? no,
profile has no README — skip), FORMULAS §14, WORKLOG entry.
