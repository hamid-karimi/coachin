# Work log

Running journal for session continuity. Newest entry first. Each entry: date ·
branch · what was done · decisions · next steps. Rules in `CLAUDE.md` § Work log.

---

## 2026-09-25 · #91 merged (4.3) · Phase 4.4 — Go is the formulas' source of truth

**Done** (branch `claude/lucid-tesla-3737vk` → PR): FORMULAS.md intro
rewritten; the 17 "Source of truth: legacy/…" lines are now "Legacy origin"; §5 and §8
gained their Go pointers. CI's "golden vectors match the legacy formulas" step removed
(a Go-only formula change would fail it); `make golden` labeled history.

**Decisions**: golden JSON stays — it pins Go and the web copies to the same vectors.

**Next steps**: Phase 4 gate (full suites + golden + QA journeys re-run), then Phase 5:
5.1 Playwright suite for the QA journeys in CI; 5.2 security review — include the RLS
findings noted earlier (`profiles_select_authenticated` is `USING (true)`,
`get_weekly_leaderboard` accepts any ids, `clubs` readable by everyone incl. invite codes).

## 2026-09-25 · #90 merged (4.2d) · Phase 4.3 — drop the retired SQL functions

**Done** (branch `claude/lucid-tesla-3737vk` → PR): migration 00010
drops `complete_plan_item`, `award_session_log_xp`, `award_meal_xp`,
`award_day_adherence`, `achieve_goal`, `evaluate_user_streak`, `apply_week_adjustment`
(Down restores the baseline bodies; default privileges re-grant EXECUTE). The streak
parity test installs `legacy_evaluate_user_streak` from `internal/store/testdata`.
`Migrator.DownTo` added (the 4.1 test now rolls back to version 8, not "one step").

**Decisions**: the rest of the SQL functions are cross-user or membership-granting and
stay (ADR-5 amendment): joins by code, club/group creation, leaving a group, schedule
assign, group-day evaluation, group_trained_today, leaderboard, create_training_plan.

**Next steps**: 4.4 FORMULAS.md — Go files the only source of truth (drop "Source of
truth: legacy/…" lines, keep them as history); then Phase 4.5 RLS hardening, Phase 5.

## 2026-09-25 · #89 merged (4.2c) · Phase 4.2d — weekly check-ins in Go

**Done** (branch `claude/lucid-tesla-3737vk` → PR):
`TrainingStore.ApplyWeekAdjustment` in Go under the profile lock — active plan length,
week bounds, check-in insert (unique (plan, week) → `ErrAlreadyCheckedIn`),
`replaceWeek` (delete + insert, target week forced), +20 via `addXP` once
(`xp.WeeklyCheckinXP`). The use case caps a rewritten week at 60 items. `rpcResult` gone.
Concurrency test: 8 parallel confirms → one +20, 7 refused.

**Decisions**: rewritten items keep their `description` (legacy's SQL dropped it, so an
adjusted strength week lost the log sheet's prefill).

ADR-5 amended: cross-user functions (coach / club / group joins by code, coach schedule
assign, `evaluate_group_days`, `group_trained_today`, `get_weekly_leaderboard`) stay
narrow `SECURITY DEFINER` primitives — Go would need RLS holes or a request-time bypass.
**Flag for the user** in the next summary.

**Next steps**: 4.2e same-user remainder — `create_training_plan`,
`create_club_with_owner`, `create_training_group`, `leave_training_group`; then 4.3 drop
the retired functions (Step A calls gone).

## 2026-09-25 · #88 merged (4.2b) · Phase 4.2c — streak settle in Go

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/streak`
`Window` (first run = yesterday only), `History.Required` (routine in its window, or a
non-meal slot of any active plan in its own week), `SettleRange` (folds `Next`);
`TodayStore.SettleStreak(ctx, user, today)` locks the profile, reads trained dates /
schedules / active-plan slots once, saves state + `streak_evaluated_date`. Parity test
seeds identical histories for two users and settles one via the SQL function, one via Go
(resets, heart spends, growth all agree), with 8 parallel Go settles.

**Decisions**: "today" now comes from the use case clock (was the DB's CURRENT_DATE;
both UTC in the containers). Settle errors now surface (the SQL function swallowed them
into a jsonb error).

**Next steps**: 4.2d check-ins / week adjustment (`apply_week_adjustment`, weekly_checkin
XP), 4.2e coaching joins/assign, 4.2f community; 4.3 drop retired functions.

## 2026-09-25 · #87 merged (4.2a) · Phase 4.2b — meals, calorie day, goals in Go

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/nutrition`
`MealAward` (5, cap 3/date) + `CalorieDayXP` (±10% via ×10 vs ×9/×11, 2+ meals; tested at
the edges), `goals.AchievedXP`; `NutritionStore.LogMeals` counts the date's awarded meals
and settles yesterday's bonus with `appnutrition.DefaultMealRules`;
`ProfileStore.AddMeasurement` marks an active goal achieved and pays +200 via `addXP`.
`decodeRPC` gone. `TestParallelAwardsPayOnce` += 8 parallel meals → 15, parallel goal
crossings → one +200.

**Next steps**: 4.2c streak settle (`evaluate_user_streak`) + weekly check-ins; then
coaching joins/assign, community (clubs/groups/leaderboard); 4.3 drop retired functions.

## 2026-09-25 · #86 merged (4.1) · Phase 4.2a — plan items + session logs in Go

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/planitem`
`CompletionXP` (60/60/30/30/20) + `ToggleXP` (net at most one award; table-tested),
`xp.SessionLogXP`; `TrainingStore.SetPlanItemCompleted` (lock profile → item → award/undo
counts → completion → log insert/delete → ledger via `store.addXP`) and
`CreateSessionLog` (lock → session log → done → `session_log:<id>` +10). The SQL
functions are no longer called. `TestParallelAwardsPayOnce`: 8 parallel done taps pay 60,
8 undos -60, 8 session logs +10.

**Decisions**: legacy `complete_plan_item` had no lock (parallel taps could double-pay);
the Go path serializes on the profile row. FORMULAS "done→undo→done nets zero" was wrong
(redo pays again) — fixed.

**Next steps**: 4.2b meals + calorie day (`award_meal_xp`, `award_day_adherence`), then
goals, streak settle, check-ins, coaching, community; 4.3 drop retired functions.

## 2026-09-25 · #85 merged (3.9 share cards) · Phase 4.1 — XP ledger once-only index

**Done** (branch `claude/lucid-tesla-3737vk` → PR): migration 00009 — partial unique index `xp_transactions_once_idx` on
`(user_id, reason)` except `plan_item:` / `plan_item_undo:` (toggle pair, counted) and
legacy undated `workout_log:<sport>`; existing duplicates relabeled `#dup<n>` (amounts
kept). `store.awardedTwice` maps a violation → `today.ErrAlreadyLogged` /
`activities.ErrAlreadyAwarded` (409 "Those days already have a logged run").
Integration test rolls 00009 back, seeds duplicates, re-migrates.

**Decisions**: a negative list (everything once-only by default) so new reason kinds are
protected without opting in. A relabeled legacy duplicate `meal_log:<id>#dup2` isn't
refunded when that meal is deleted (only the original award is) — acceptable.

**Next steps**: 4.2 SQL functions → Go (plan items + session logs first), each with a
concurrency test; 4.5 RLS hardening.

## 2026-09-25 · #84 merged (3.8c) · Phase 3.9 — Share cards (Phase 3 complete)

**Done** (branch `claude/lucid-tesla-3737vk` → PR): web-only port of legacy share cards —
`lib/share-card.ts` (session / meal / day / progress builders, privacy: additive stats,
never body weight or targets; tested), `lib/share-card-canvas.ts` (canvas renderer; colors
from the `.dark` theme tokens, page font, waits for fonts), design-system
`share-card-sheet` + `share-button` (stories), `components/hooks/use-share-card.ts`
(reducer). Entry points: "Share it" after a strength log, "Share today" + meal row icon on
Nutrition, "Share progress" on the progress compare. e2e: all four render (1080×1920 /
1080×1080), Save image downloads, photo backdrop works.

**Decisions**: singular stat labels ("1 set"); no raw hex in the renderer (legacy
mirrored the palette by hand).

**Next steps**: Phase 4 — 4.1 XP ledger unique index (rewrite legacy reasons first), 4.2
SQL functions → Go use cases (one PR per group, with concurrency tests), 4.5 RLS
hardening (profiles `USING (true)`, `get_weekly_leaderboard` ids, `clubs` readable by all).

## 2026-09-25 · #83 merged (3.8b) · Phase 3.8c — Group streaks (Phase 3.8 done)

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `community.GroupsService` (Groups —
settles finished days via `evaluate_group_days` first —, CreateGroup, JoinGroup,
LeaveGroup, Nudge) + store queries; `/community/groups` (+ join, membership) and
`/community/group-nudge`. Web `/community/groups` (forms, group card, leave confirm),
Today's `group-nudge.tsx` (prefetched only with the flag on). e2e with the flag on:
create → coach joins (lowercase code) → both members → Today nudge → leave.

**Decisions**: migration 00008 — a new group settles from the day it got its 2nd member
(legacy settled yesterday on the first look: a group formed today paid every member for
a day before it existed, repeatable with fresh groups). Members' weekly XP fixed (legacy
read the wrong column → always 0). Group member rows show no tier (not returned).

**Next steps**: share cards ("Share it", "Share today", meal share, "Share progress");
then Phases 4–7 (4.1 XP unique index, 4.2 SQL functions → Go incl. group evaluation,
4.5 profile/club RLS hardening).

## 2026-09-25 · #82 merged (3.8a) · Phase 3.8b — Community circle

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `community.CircleService` (Circle,
People, Follow, Unfollow) + store queries (`SearchPeople`: name ILIKE with escaped
wildcards or exact email, following flag, paging); `/community/circle`,
`/community/people`, `/community/follows`. Web `/community/circle` (following, search,
my coaches + join form), `lib/roles.canTrain`. e2e with the flag on.

**Next steps**: 3.8c group streaks (create / join / leave, trained-today, group-day
evaluation, Today nudge); then share cards; Phases 4–7.

## 2026-09-25 · #81 merged (3.7 Coaching) · Phase 3.8a — Community boards + clubs

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `app/community` (Leaderboard with
lifetime fallback, Clubs, CreateClub with code retry, JoinClub, SetPrimaryClub, LeaveClub
with primary hand-off) + `store.CommunityStore`; `communityOnly` middleware → 404 while
`FEATURE_COMMUNITY` is off; `/community/leaderboard`, `/community/clubs` (+ join, primary,
membership). Web `/community` layout (flag guard, tabs), boards, clubs. e2e with the flag
on (`FEATURE_COMMUNITY=true docker compose … up`): trainee creates a club, coach joins,
club board, leave.

**Decisions**: leaderboard rows drop email (legacy exposed every user's email on the
global board); clubs are read only through the caller's memberships (the `clubs` table
is readable by everyone, invite codes included — Phase 4.5 hardening).

**Next steps**: 3.8b circle (follows, discover search, my coaches), 3.8c groups + Today
nudge; then share cards; Phases 4–7.

## 2026-09-25 · #80 merged (3.6d, Profile done) · Phase 3.7 — Coaching

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/coaching` (WeekStrip, invite
code shape), `supplements.Window`; `app/coaching` (Hub, Summary, GenerateInviteCode, Join,
AssignWeeklyPlan; NutritionService.TraineeNutrition) + `store.CoachingStore` (weekly XP via
`get_weekly_leaderboard` for the coach's trainees only, raw query — sqlc can't type the
table function); `/coaching`, `/coaching/summary`, `/coaching/invite-codes`,
`/coaching/join` (rate limited), `/coaching/trainees/{id}/weekly-plan`,
`/coaching/trainees/{id}/nutrition`. Web hub (roster, `design-system/adherence-week-strip`
+ story, invite codes, leaderboard), trainee nutrition page, Today coaching card, Profile
"My coach". e2e with the seeded coach + trainee.

**Decisions**: coach photo access stays owner-only (legacy had no coach policy on
`body_photos`; the ADR's "or active coach" was aspirational). "My coach" shows only while
Community is off (legacy).

**Next steps**: 3.8 Community (clubs, follows, groups, leaderboard, discover; 404 while
the flag is off) — then share cards, Phases 4–7 (4.1 XP unique index, 4.5 profile column
hardening: `profiles_select_authenticated` is `USING (true)` and
`get_weekly_leaderboard` accepts any ids).

## 2026-09-25 · Phase 3.6d — body analysis + report extraction (Profile done)

**Done** (branch `claude/lucid-tesla-3737vk`, on top of #79 until it merges):
`aigen.BodyAnalysisRequest`/`ParseBodyAnalysis`, `ReportRequest`/`ParseReportMetrics`;
`app/photos` Library / Analyze / Extract; `POST /photos/analyze`,
`POST /photos/{id}/extract`, `GET /photos` + `analysis`/`consented`; `LatestBodyAnalysis`
now body photos only (legacy bug: a newer report hid the analysis from the plan prompts).
Web: consent + analysis card, "Extract metrics" → "Save as measurement". e2e with the
fake AI: consent refusal, analysis card, extraction prefill 74.2 / 16.5 → measurement.

**Next steps**: 3.7 Coaching (invite codes, join, roster/adherence, consent-gated
trainee nutrition/supplements, assign weekly plan, coach-mode generation; decide coach
photo access), 3.8 Community, share cards, Phases 4–7.

## 2026-09-25 · #78 merged (3.6b) · Phase 3.6c — photos

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `objectstore` Put/Get/Delete;
`adapters/imaging` (pure Go: JPEG/PNG/WebP decode, EXIF orientation parser, CatmullRom
fit ≤1600, JPEG q82; dep `golang.org/x/image`); `aigen.ModerationRequest`/`ParseModeration`,
`Request.Strict` + `Result.Blocked` in `adapters/ai`; `app/photos` + `store.PhotoStore`
(cap-checked insert under the profile lock — 8 concurrent → 5); `POST/GET /photos`,
streamed `GET /photos/{id}`, `DELETE`; web Body photos + Progress photos (compare). e2e
with the fake moderator (wide = report, square = explicit, tall = body): batch 2 kept + 1
rejected, stream 600×900, delete, journal + compare, report refused in journal, 401
signed out.

**Next steps**: 3.6d analysis (consent, all body photos in one call, stored on the newest)
+ report extraction → "Save as measurement"; then 3.7 Coaching (check whether legacy let
the active coach read trainee photos — architecture ADR says "owner, or active coach";
`GET /photos/{id}` is owner-only for now), 3.8 Community, share
cards (incl. "Share progress"), Phases 4–7.

## 2026-09-25 · #77 merged (3.6a) · Phase 3.6b — watch-data import

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `app/activities.Importer` +
`store.ActivityStore.ImportRuns` (running sport, logged dates, logs + ledger + XP in one tx
under the profile lock), `POST /activities/import`; web Body tab "Watch data" section.
Fixed `xp.ReasonLabel` for the API's dated `workout_log:<sport>:<date>` reasons (was
only the legacy form). e2e: 2 GPX files → 1 imported (+60), 1 out of window; re-import →
"Those days already have a logged run"; calendar shows the day logged.

**Next steps**: 3.6c photos (Garage adapter in `adapters/storage`?, pure-Go re-encode,
Gemini moderation, `POST /photos`, streamed `GET /photos/{id}`, `DELETE`, analyze /
extract, consent), then 3.7 Coaching, 3.8 Community, share cards, Phases 4–7.

## 2026-09-25 · #76 merged (3.5c) · Phase 3.6a — Profile tabs, goals, measurements

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `app/profile` (body profile,
sharing, overview, progress, measurements, goals) + `ProfileStore` + `db/queries/profile.sql`;
endpoints `/me/body`, `/me/nutrition-sharing`, `/me/overview`, `/me/progress`,
`/measurements`, `/goals`; `domain/goals.Settle` (baseline rule — fixes legacy paying
+200 on a start-less weight-loss goal; FORMULAS §6), `domain/xp.ReasonLabel`. Web
`/profile` 4 tabs (`?tab=`, per-tab prefetch in `app/lib/profile-data.ts`), Today goal
strip, `components/ui/native-select` (+ story). e2e: goal baseline then payout
(+200, confetti), body profile save, measurements + chart order, sharing toggle, remove.

**Next steps**: 3.6b watch-data import (`POST /activities/import`, FORMULAS §14 — the
parse endpoint already exists), then 3.6c photos (Garage adapter, re-encode, moderation,
`GET /photos/{id}`, analyze/extract), 3.7 Coaching, 3.8 Community, share cards, Phases 4–7.
Suggested follow-up: move the 7 hand-styled `<select>`s onto `NativeSelect`.

## 2026-09-25 · #75 merged (3.5b) · Phase 3.5c — AI meal plan (Nutrition done)

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `aigen.MealPlanRequest`/`ParseMealPlan`
(golden `ai.json`, mealPlan cases), `app/nutrition.Plans` (page, generate, regenerate,
discard; targets via `ComputeTargets`, 0 schedule days → 3 — now in FORMULAS §10),
one-tx `SaveMealPlan` (archive old, insert plan + meals, set/insert calorie goal),
`GET/POST/DELETE /nutrition/plan` + `/regenerate` (rate limited); `GET /today`
`mealPlan`, `GET /calendar` `days[].meals` + adherence (today/past only). Web
`/nutrition/plan` (wizard + plan view + grocery list), "Meal plan" pill, Today's meals
card, calendar meal line. e2e with the fake AI (now answers "Design a 7-day meal plan"):
missing-metrics error, generate → 2,890 kcal target synced to the Meals tab, Today card,
7 calendar lines / 5 adherence lines, regenerate, discard.

**Decisions**: Profile isn't ported yet, so the e2e set height/weight/birth date by SQL;
the wizard's metrics error points at the profile, which 3.6 delivers.

**Next steps**: 3.6 Profile (measurements, goals, activity import, photos via Garage,
analyze/extract, `?tab=`), then 3.7 Coaching, 3.8 Community, share cards, Phases 4–7.

## 2026-09-24 (night, final+4) · #74 merged (3.5a) · Phase 3.5b — photo estimate

**Done** (branch `claude/lucid-tesla-3737vk` → PR): vision support in `adapters/ai`
(`aigen.Request.Images`), `aigen.MealPhotoRequest`/`ParseMealEstimate` proven against the
legacy builder (15 golden cases), `EstimatePhoto` / `ConfirmPhotoMeal` use cases,
`POST /meals/photo-estimate` (multipart, 8 MB cap, content-sniffed images) and
`POST /meals/batch`; web Photo tab (`lib/client-image` compression + EXIF strip, review
reducer, search-to-add). Fixed the trends week chart (bars had no height). e2e with the
fake AI: 2 photos reach the model, review edit + olive oil added, "3 items logged · +10
XP" (cap respected).

**Next steps**: 3.5c AI meal plan (`/nutrition/plan`: intake, targets via
`domain/nutrition.ComputeTargets`, 7-day menu, grocery list, regenerate/discard),
Today's menu card, calendar meal line + adherence.

## 2026-09-24 (night, final+3) · #73 merged (3.4) · Phase 3.5a — meal logging

**Done** (branch `claude/lucid-tesla-3737vk` → PR): migration 00007 (`foods.fdc_id`
unique), `USDA_API_KEY` config, `adapters/usda` (search + re-read by id, lenient nutrient
shapes; sandbox can't reach USDA — tested against a fake), `domain/nutrition.Portion`,
`app/nutrition` (day, search, log, delete) + `NutritionStore` (meal XP + adherence in one
tx under the profile lock; delete refunds meal XP — FORMULAS §1 updated), endpoints; web
`/nutrition` (summary, logger with search/USDA/manual + household units, meal groups,
trends). e2e: oats 0.5 cup → 120 g "+5 XP", manual soup, delete "-5 XP".

**Next steps**: 3.5b photo estimate (Gemini/Claude vision; up to 3 compressed photos +
hint; review sheet; batch confirm via `LogMeals`), then 3.5c meal plans.

## 2026-09-24 (night, final+2) · #72 merged (3.3d) · Phase 3.4 — Calendar (merged as #73)

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `app/calendar`
+ `CalendarStore` (schedules overlapping the week, items of every active plan's week in
one query — plan and calendar weeks are both Monday-anchored), `GET /calendar?week=`;
web `/calendar` (week nav, weekly targets, day cards with routine/plan sheets, rest
days, collision chip); plan sheet + type icon moved to `app/(app)/components`; plan
progress mutations refetch the calendar. e2e: this week, plan sheet, Next/Prev.

**Next steps**: merge the 3.4 PR; then 3.5 Nutrition (largest remaining
module: USDA proxy, meal logs, photo estimate, meal plans — also adds the calendar's
meal-plan line and Today's menu).

## 2026-09-24 (night, final+1) · #71 merged (3.3c) · Phase 3.3d — watch-file parsing

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `adapters/watchfile`
(FIT via `muktihari/fit` v0.28.4, GPX via `encoding/xml` raw tokens reproducing
fast-xml-parser's shapes/quirks) + `activity.FromTotals`; 20 fixtures in
`testdata/activity/` with expected summaries from the real legacy parser
(`scripts/golden/activity-files.ts`, `make golden-activity GOLDEN_DEPS=…` — needs
`@garmin/fitsdk@21 fast-xml-parser@5` installed outside the repo, so it is NOT part of
`make golden`); `app/activities` + `POST /activities/parse` (multipart, body capped at
20 MB — huma doesn't cap multipart); wizard step 4 "Watch data" (upload, list, runs sent
as `activities`). e2e: 2 files parsed + 1 skipped, the generation request carries them.

**Next steps**: 3.4 Calendar (`GET /calendar?week=`), then 3.5 Nutrition.

## 2026-09-24 (night, final) · #70 merged (3.3b) · Phase 3.3c — session logs + weekly check-in

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/aigen` session-feedback and
week-adjustment ports (red-flag precheck, parse rules; golden `ai.json` now 78 cases),
`jsnum.FormatEnUS`; `app/training` `Sessions.LogSession` (legacy messages, actual JSON in
legacy key order, one-tx log + done + `award_session_log_xp`, non-fatal AI feedback with
the persisted flagged-note fallback) and `Checkins` (Proposal / Confirm around
`apply_week_adjustment`); store + sqlc queries; `POST /plan-items/{id}/session-log`,
`GET/POST /training/plans/{id}/checkin`. Web: "Log details" sheet on Today's plan rows
(RPE, run fields, per-set strength editor; `lib/workout-sets` replays `workout-sets.json`),
check-in page (server-fetched proposal, loading state), `components/ui/textarea` (+ story;
the wizards use it now). e2e on the sandbox stack with the fake AI (now also answering
feedback/adjustment prompts): log → "+10 XP · You lifted 600 kg total — that's a horse
🐎 · 🏃 …"; check-in → "Week 3 updated · +20 XP", banner gone, re-open redirects.

**Decisions**: confirm recomputes scorecard + decision server-side (legacy trusted the
client); the proposal is fetched once on the server, never through TanStack (each GET is
an AI call, rate limited 5 then 1/10 s; session logs 6 then 1/10 s). "Share it" cards are
left for the share-card step. No formatter is configured: when formatting, use
`prettier --print-width 120 --jsx-single-quote --bracket-same-line` on changed files only.

**Next steps**: 3.3d FIT/GPX parsing (running wizard upload + profile watch import), then
3.4 Calendar.

## 2026-09-24 (night, very late) · #69 merged (3.3a) · Phase 3.3b — AI plan generation

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `domain/aigen` (schema hint,
extract-json, anchors block, marathon + hypertrophy prompts, item validation, plan
parsing) proven byte-identical to legacy by `testdata/golden/ai.json` — generated by
running the real legacy builders with `@google/genai` and `text-json` stubbed in
`scripts/golden/hooks.mjs`. `adapters/ai` (anthropic-sdk-go v1.75.0 streamed, genai
v1.71.0 fallback), config `CLAUDE_*`/`GEMINI_*`, `app/training` generation (validation,
coach mode, profile/anchors/calorie/body-analysis personalization, `create_training_plan`),
endpoints + rate limit, web wizards, `lib/running` with golden replay.

**Bugs found by e2e**: (1) the Go SDK refuses non-streaming 24k-token requests → streaming;
(2) React reused the wizard's Continue button as the submit button → submitted a step
early (fixed with keys; legacy had the same pattern).

**Next steps**: 3.3c session logs + weekly check-in; 3.3d FIT/GPX parsing. Local AI e2e
without keys: a fake Anthropic server + `ANTHROPIC_BASE_URL` (see this session's notes).

## 2026-09-24 (night, latest) · #67, #68 merged (3.2 done) · Phase 3.3a — programs page

**Done** (branch `claude/lucid-tesla-3737vk` → PR): `GET /training/programs`,
`POST /training/plans/{id}/archive`, `GET /training/calendar.ics` (`domain/ics`,
`planitem.DetailLine`/`VideoURL` with JS number formatting + `encodeURIComponent`);
web `/training` (cards, check-in banner, archive confirm, .ics download), `lib/plan-title`;
placeholders for `/training/new` and `/training/checkin`. CI smoke covers training.
Verified: unit/HTTP/Postgres tests; Playwright (ICS download, check-in link, archive).

**Next steps**: 3.3b — AI adapters in Go (`adapters/ai`: Claude primary → Gemini fallback,
prompts verbatim from `legacy/lib/ai/*`, `extract-json`/`schema-hint`/`anchors` with
golden vectors), plan generation endpoints + the two wizards, FIT/GPX parsing.

## 2026-09-24 (night, later) · Phase 3.2b — daily supplements (Today complete)

**Done** (branch `claude/lucid-tesla-3737vk`, after #67): `app/supplements` (add with
legacy limits, reschedule, remove, taken toggle with an ownership check), the stack with
due/taken on `GET /today` (training-day rule incl. the no-structure fallback),
`domain/supplements.Normalize`, migration `00006` (UPDATE policy — legacy schedule edits
silently failed). Web: Daily stack card + manage sheet, optimistic check. Verified with
unit, HTTP, Postgres integration tests and Playwright on the stack.

**Also**: #67's smoke test failed because React rendered `Hi, <!-- -->CI`; the greeting is
now one text node (fix pushed to #67).

**Next steps**: merge #67, then open the 3.2b PR; then 3.3 Training (plans list, AI
generation adapters, check-ins, session logs, FIT/GPX).

## 2026-09-24 (night, late) · #66 merged (3.1) · Phase 3.2a — Today

**Done** (branch `claude/lucid-tesla-3737vk` → PR into `feat/backend-rewrite-with-go`):
- API: `app/today` (`GET /today`: streak settle via `evaluate_user_streak`, stats,
  today's sessions + completion, plan items across all active plans, collision flag,
  done/total, quota chips, progress-photo nudge; `POST /today/workouts`: log + ledger +
  balance in one transaction under a profile row lock, once per sport per day) and
  `app/training` (`PUT /plan-items/{id}/completion` → `complete_plan_item`, log window
  checked in Go). Migration `00005_xp_awards.sql`: INSERT policy on `xp_transactions`
  for `coachin_app`. `routine.ProgressFor`, `dates.WeekRange`, `planitem`
  collision/window rules.
- Web: Today page (header, level/XP, hearts, stats, plan card, quota chips, entry
  cards, photo nudge, today's plan with workout cards + confetti), shared optimistic
  `PlanItemRow`, `use-confetti-burst` (theme-token colors; `canvas-confetti` 1.9.4),
  placeholders for Training / Calendar / Nutrition.
- Verified: vet/lint/race tests incl. Postgres (log once, XP ledger = balance, plan
  item +60/0/-60/+60, window, meal note, other user 404); web 103 tests + build;
  Playwright on the stack (log it → reward + tally, plan item done/undo toasts, reload).

**Decisions**: workout XP reason is now `workout_log:<sportId>:<date>`; plan 4.1 notes the
legacy-reason cleanup needed before the unique index.

**Next steps**: merge 3.2a → 3.2b supplements (CRUD, taken toggle, due-today using
`domain/supplements`; Today card + manage sheet), then 3.3 Training.

## 2026-09-24 (late night) · #65 merged (Phase 2 done) · Phase 3.1 — My week

**Done** (branch `claude/lucid-tesla-3737vk` → PR into `feat/backend-rewrite-with-go`):
- API: `app/routine` (sport types, week view, add/remove fixed sessions, save/remove weekly
  targets) on `store.RoutineStore` (sqlc `db/queries/routine.sql`, every query also filters
  by user; `WithUser` for RLS). Endpoints `GET /sport-types`, `GET /routine`,
  `POST /routine/schedules`, `DELETE /routine/schedules/{id}`,
  `PUT|DELETE /routine/quotas/{sportTypeId}`. Legacy validation messages kept.
- Shared pieces for every later module: `app/apperr` (use-case errors → problem+json via
  `httpapi/problem.go`), `domain/planitem.ParseDetails` (lenient AI details),
  `xp.Multiplier` / `xp.EstimatedWeeklyXP`, OpenAPI arrays are non-nullable
  (`huma.DefaultArrayNullable = false` — handlers must return non-nil slices).
- Web: `/onboarding` ported (server prefetch → `HydrationBoundary`, suspense queries,
  `useMutationFeedback` toasts + refetch, `prefetchQueries` helper, `serverQueries()`),
  lib `sports` / `week-days` / `plan-items` ported with tests; Today placeholder links to it.
- Verified: go vet/lint/race tests (incl. Postgres integration: RLS isolation, upsert,
  plan week), web typecheck/lint/97 tests/build; Playwright on the compose stack (add
  session with validation, weekly target, removes, AI plan sheet, finish).

**Decisions**: quotas are addressed by sport (`/routine/quotas/{sportTypeId}`), one per
user × sport; deletes are idempotent; unported: unused legacy `DaySportPicker`.

**Next steps**: merge 3.1 → 3.2 Today (`GET /today`, streak settle, workout log,
supplements, optimistic toggles). Remember: mutations there must also invalidate
`["get","/routine"]` (quota progress) once logs change.

## 2026-09-24 (late night) · Phase 2 PR 2B — web auth

**Done** (branch `claude/lucid-tesla-3737vk` → PR into `feat/backend-rewrite-with-go`):
- `$api` browser client (openapi-react-query), `problemMessage`, zod auth schemas with
  legacy messages, password checklist; screens: login, register, forgot, reset, verify.
- `/` routes by role via `GET /me` (`app/lib/me-data.ts`, request-cached); status page
  moved to `/status` (CI stack job updated). `(app)` layout checks the session and renders
  `AppShell`; nav gets `coachNav` + `communityNav` (from `/me` features) as props —
  `lib/nav.ts` holds routes, active-tab and visibility logic (tested).
- Profile: change password + logout. Dashboard/coaching are placeholders.
- `proxy.ts`: cookie-presence redirect only; auth pages bounce a *verified* session home,
  so a stale cookie never loops. `serverApi()` reads cookies first so builds don't
  prerender API-backed pages.
- Verified: typecheck, lint, 39 web tests, `next build`; on the compose stack via Caddy
  with Playwright: bad/good login, role landing, nav gating, change password, logout.

**Next steps**: merge 2B → Phase 2 done. Phase 3.1 (onboarding / weekly routine) — first
module slice: sqlc queries + handlers + port the pages.

## 2026-09-24 (night) · #63 merged (Phase 1 done) · Phase 2 PR 2A — auth API

**Done**: #63 merged → Phase 1 complete. This PR is the auth API:
- `00004_auth.sql`: `app.sessions` / `app.auth_tokens` (digests only), `coachin_auth`
  role grants (new role in `deploy/postgres/initdb`, needs `make reset-db` on existing
  volumes), `coachin_app` loses access to `users.password_hash`.
- sqlc introduced (`sqlc.yaml`, `db/queries/auth.sql`), CI runs `sqlc diff`.
- `adapters/password` (argon2id; bcrypt legacy verify → rehash), `adapters/mail` (SMTP),
  `app/auth` (register creates the profile — prod used an untracked dashboard trigger —
  login, logout, verify, forgot/reset/change, `/me`), HTTP endpoints with legacy messages,
  rate limits, CrossOriginProtection, client IP from the last XFF hop (chi RealIP is
  deprecated as spoofable). `api seed` / `make seed` demo accounts (password Coachin-demo1).
- Verified: unit + real-Postgres integration tests; full journey on the compose stack
  through Caddy + Mailpit (register → email → verify → logout → login → cross-site 403).

**Found**: legacy RLS lets a user update any column of their own profile (role/xp/hearts) →
plan 4.5.

**Next steps**: merge 2A → PR 2B (web): `$api` browser client + auth screens (login,
register, forgot, reset, verify, change password), `proxy.ts` cookie redirect, `/me` role
routing, app shell/nav with the community flag; then QA-ONBOARDING auth journey update.

## 2026-09-24 (night, latest) · #62 merged · Phase 1 PR B4 — last domain ports; Phase 1 done

**Done**: #62 (nutrition + supplements) merged. This PR ports activity import §14
(`domain/activity`), progress charts + photo nudge §15 (`domain/progress`), and schedule
rows + country resolution (`domain/profile`) — 783 new vectors, all matching. Vectors are now
generated with Node 24 (same ICU/CLDR 48 as CI; committed files unchanged).
Phase 1 complete: plan 1.1, 1.3–1.6 ticked (1.2 seed → Phase 2).

**Decisions**:
- Country names: Go's x/text CLDR is older (Turkey/Swaziland/Macedonia) → a static
  279-entry table generated from Node 24 ICU (`country_names_gen.go`).
- `resolveUserCountry` used Vercel's `x-vercel-ip-country` header; there is no geo header on
  the VPS, so only the profile country applies unless a proxy adds one later.
- Moved to Phase 3.3: race-intake gates §5 and the AI helpers (extract-json, schema-hint,
  anchors) — they live beside the AI adapter / training use case.

**Next steps**: merge B4 → Phase 2 (auth): `00004_auth.sql`, argon2id + bcrypt legacy,
sessions, email verify/reset via Mailpit, `/me`, `api seed` + `make seed`, web auth screens.

## 2026-09-24 (night, later) · #61 merged · Phase 1 PR B3 — nutrition + supplements

**Done**: #61 merged. This PR ports nutrition targets §10, food units, nutrition trends,
meal adherence + grocery list (§8/§13) → `domain/nutrition`, and supplement due rules +
taken rate (§13) → `domain/supplements`. 630 new vectors, all matching (grocery order via
`golang.org/x/text/collate`, matching JS `localeCompare`).

**Decisions**: legacy `isFoodUnit` treats `Object.prototype` keys ("toString") as units → NaN;
the Go port treats every unknown unit as grams (documented intent), probe removed from
vectors. Presentation helpers (share-card, labels, plan titles, sport icons, weekdays,
collision warning) stay TypeScript and move to `apps/web/lib` in Phase 3 — listed in plan 1.5.

**Next steps**: merge B3 → B4: activity import §14, progress charts + photo nudge §15,
schedule inserts, user country, race intake §5, AI JSON helpers. Then Phase 1 is done →
Phase 2 (auth).

## 2026-09-24 (night) · #60 merged · Phase 1 PR B2 — goals, scorecard, quotas, workout sets

**Done**: #60 (golden vectors + xp/tiers/streak/running/dates) merged, CI green incl. the
golden-drift check. This PR ports FORMULAS §6 goals, §7 scorecard/check-in/stall
detection, §11 weekly quotas, §12 workout sets/volume — 266 new vectors, all matching,
including deliberately malformed session-log JSON. `jsnum` gained JS `Number()`/`String()`
on decoded JSON (null vs missing key), `Number.isInteger`, UTF-16 `slice`, Unicode `trim`.

**Decisions**: loosely-typed JSON (plan details, session logs) is ported as `any` with JS
coercion helpers so behavior on bad data is identical; Go regexes use an explicit JS
whitespace class; stall-detection output keeps first-logged order like the JS Map.

**Next steps**: merge B2 → B3: nutrition §8/§10, supplements + meal adherence §13, race
intake §5, then activity summary §14, charts/photo nudge §15, share-card, plan-items,
schedule-inserts, food-units, grocery, sports, user-country, AI helpers.

## 2026-09-24 (late) · #59 merged · Phase 1 PR B1 — golden vectors + first domain ports

**Done**: #59 (baseline schema) merged. This PR:
- `scripts/golden/` + `make golden`: runs the legacy TS formulas directly with Node (type
  stripping + a resolve hook for `@/` imports), clock pinned per case, `TZ=UTC`, seeded
  PRNG → `testdata/golden/*.json` (1,003 vectors). CI regenerates and fails on drift.
- Go ports, each replaying its vectors: `domain/xp`, `tiers`, `streak`, `running`, `dates`
  (+ `jsnum`: JS `Math.round` / `Number()` semantics — Go's `math.Round` differs on
  negative halves). All vectors pass. FORMULAS.md §1–4, §9 now name the Go files.

**Decisions**: one Go package per formula topic (`xp.Level`, `streak.Next`, …); date
functions take `now` explicitly; hearts is an int in Go (fractional-hearts vector dropped).

**Next steps**: merge B1 → B2: goals §6, scorecard/check-in §7, quotas §11, volume §12
(workout-sets), then nutrition/supplements/charts/share-card/AI helpers.

## 2026-09-24 (evening) · Phase 0 merged (#58) · Phase 1 PR A — clean schema

**Done**: #58 merged into `feat/backend-rewrite-with-go` after 2 CI fixes (pnpm 12
`minimumReleaseAge` → pinned lucide-react 1.47.0 / vite 8.3.0; Caddy now waits for a
healthy `web`, removing a startup 502). Owner said to ignore the failing Vercel status on
rewrite PRs (Vercel still builds every branch; not ours to fix).

Phase 1 PR A (this branch):
- `00002_baseline.sql` — legacy schema replayed + dumped + rewritten (users table,
  `app.current_user_id()`, `coachin_app`), 28 tables / 23 SQL functions / 69 policies.
  Recipe is documented in the file header; the converter script was one-off.
- `00003_reference_data.sql` — sport types (legacy seed + core sports that prod had
  hand-entered, neutral 1.0 multiplier) and 73 starter foods.
- `store.WithUser` + RLS tests (every table has RLS; cross-user isolation; fail-closed).

**Decisions**: demo seed moved to Phase 2 (needs password hashing); auth tables become
`00004_auth.sql`; importer (Phase 7) must replace sport_types/foods with prod rows + ids.

**Next steps**: merge PR A → Phase 1 PR B: `scripts/export-golden.ts` + port pure `lib/`
modules to `internal/domain` with golden vectors, a few topics per PR.

## 2026-09-24 · `claude/lucid-tesla-3737vk` → PR into `feat/backend-rewrite-with-go` — Phase 0 done

**Done** (plan Phase 0, all boxes ticked in `plan.md`):
- Old app `git mv`'d to `legacy/` (read-only reference); FORMULAS/QA paths → `legacy/…`.
- `apps/api` (Go 1.27.1): chi + huma (OpenAPI 3.1), env config, `/api/v1/healthz`,
  `/readyz` (DB + Garage), subcommands `serve|migrate|storage-init|openapi|healthcheck`,
  migration `00001_app_schema.sql` (`app.current_user_id()`, grants to `coachin_app`),
  Garage bootstrap via admin API v2 (idempotent). Tests: unit + testcontainers migration test.
- `apps/web`: fresh Next 16.3.6 / React 19.3 / TS 6.0.3 / Tailwind 4.3.3 / TanStack Query /
  nuqs / Storybook 10.6 / vitest 5 / ESLint 10; design system copied (nav trio waits for
  Phase 2.6); status page renders `/readyz` server-side via the generated client.
- `compose.yaml` (+ `compose.dev.yaml`), `deploy/` (Caddy, Garage, Postgres init),
  `.env.example`, `Makefile`, CI `.github/workflows/rewrite-ci.yml`, README, CLAUDE.md.

**Verified in the cloud sandbox**: go vet / golangci-lint / `go test -race` (incl. real
Postgres 18.6), web typecheck / lint / test / build / Storybook build; full compose stack
healthy through Caddy (API ↔ Postgres as `coachin_app`, ↔ Garage), storage degrade→recover,
idempotent re-`up`, dev mode `next dev` + file-sync hot reload (~4 s).
**Not verified here**: the Dockerfiles' own build stages (sandbox containers have no
internet) — CI's stack job builds them for real; first CI run is the check.

**Decisions**: migrations live in `apps/api/db/migrations` (embedded); package
`internal/transport/httpapi`; `compose.dev.yaml` instead of an auto-loaded override (the
VPS runs `compose.yaml` alone); no root pnpm workspace; `eslint-plugin-react` needs
`settings.react.version` under ESLint 10; pnpm 12 needs `allowBuilds` for esbuild +
unrs-resolver; Garage binds IPv4 (`0.0.0.0`).

**Next steps**: watch CI on the PR → merge into `feat/backend-rewrite-with-go` → Phase 1
(clean baseline schema `00002_baseline.sql`, seed + `make seed`, RLS smoke test, golden
vectors, domain port).

## 2026-09-24 (latest) · branch setup — `feat/backend-rewrite-with-go`

**Done**: created **`feat/backend-rewrite-with-go`** from `develop` (`ddf833a`) as the
rewrite's mother branch. Rule recorded in `CLAUDE.md` § "Go rewrite — branch workflow" and
in `plan.md`: `main`/`develop` stay on Vercel + Supabase untouched; every rewrite PR
targets the mother branch. The rewrite docs land there via PR from
`claude/lucid-tesla-3737vk`.

**Next steps**: owner confirms spec §10 → Phase 0 on a new branch off the mother branch.

## 2026-09-24 (later) · `claude/lucid-tesla-3737vk` — rewrite docs revised: no Supabase, no Vercel

**Done**: rewrote `plans/go-backend-rewrite/{spec,architecture,plan}.md` for the owner's
decisions: **zero Supabase, zero Vercel**, everything local in Docker on macOS first, a
single VPS later. Docs only; no code changed.

**Decisions**: PostgreSQL 18.6; auth built into the Go API (argon2id, opaque session
cookie, email verify + password reset via SMTP; Mailpit locally); clean schema with our
own `users` table and `app.current_user_id()` replacing `auth.uid()`, RLS kept, API runs as
non-owner `coachin_app`; object storage **Garage v2.4.1** (MinIO community is
maintenance-only with no official images; RustFS 1.0 judged too fresh) behind an S3
interface, private, photos streamed by the API; Caddy 2.11 as the single entry point
(local :8080, VPS automatic HTTPS). Old app moves to `legacy/` as reference; Supabase data
imported once at go-live (Phase 7).

**Next steps**: owner confirms spec §10 defaults (import existing data? SMTP provider?
domain) → Phase 0 (legacy move, compose stack, Go + web scaffolds, Makefile, CI).

## 2026-09-24 · `claude/lucid-tesla-3737vk` — Go backend rewrite: spec + architecture + plan (docs only)

**Done**: `plans/go-backend-rewrite/` — `spec.md` (problem, goals, endpoint map for all 54
server actions + 3 routes, acceptance criteria, risks), `architecture.md` (8 ADRs + latest
version matrix as of today), `plan.md` (Phases 0–6, strangler per module). No code changed.

**Decisions proposed (not yet approved)**: monorepo `apps/web` + `apps/api`; Go 1.27 with
chi + huma (OpenAPI 3.1 → generated TS client via openapi-fetch/openapi-react-query);
pgx + sqlc + goose; Go-owned opaque session cookie with pluggable credential store (GoTrue
first, native bcrypt→argon2id later); **RLS kept** by setting `request.jwt.claims` per tx;
RPCs called from Go first, then ported to Go and dropped; Next rewrites `/api/*` → Go;
TanStack Query + nuqs + RHF/zod on web. TS pinned to 6.0.3 (typescript-eslint lacks TS 7).

**Next steps**: user reviews spec §10 open questions + ADRs → start Phase 0.1–0.3
(git mv to `apps/web`, dep upgrades, Go scaffold).

## 2026-07-20 · `fix/review-findings`

**Done**: `4eec4a4` — fixes from a code review of PRs #52/#53:

- Community flag now gates social **server actions** (clubs/follows/groups
  return "disabled"; coach invite + plan-assign flows stay open) — actions
  are public endpoints even with UI hidden.
- `deleteBodyPhotoAction`: DB row deleted before storage object (no more
  broken-image rows holding a cap slot on partial failure).
- `lib/progress-charts.ts`: consistent local-time day bucketing
  (`exerciseTopSets` used a UTC slice; `weightSeries` parsed date-only
  strings as UTC midnight).
- Share-card headline fallback is per-builder (empty meal title → "Meal",
  not "Training day").
- `ShareCardSheet`: blob-URL revoked on unmount; non-cancel share errors
  toast + fall back to download; render effect keyed on data content.
- Dashboard photo-nudge rule → `lib/progress-photo-nudge.ts` (+5 tests);
  FORMULAS.md §15 added (chart rules + nudge); QA doc + community README
  updated. tsc/eslint/216 tests green.

**Next steps**: push + PR → develop (gh CLI is UNAUTHENTICATED on this
machine — `gh auth login` needed, or push/PR manually). Still outstanding
from #52: verify migration `20260709150000_progress_photos.sql` is applied
to hosted Supabase. User has follow-up questions/requests pending.

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
