# Plan — Go backend rewrite, self-hosted

Spec: [`spec.md`](spec.md) · Architecture: [`architecture.md`](architecture.md)

Strategy: **build the new stack side by side, locally, module by module.** Today's app
moves to `legacy/` as a read-only reference (production on Vercel + Supabase keeps running
untouched until go-live). The new `apps/web` + `apps/api` grow one module at a time on the
local Docker stack; nothing needs Supabase at any point. At go-live, data is imported once
and the old hosting is switched off.

Sizing: **S** ≈ one focused session · **M** ≈ 2–3 · **L** ≈ 4+.

---

## Phase 0 — Local platform (M)

Goal: `make up` on your Mac starts an empty but working stack.

- [x] 0.1 `git mv` the current app into `legacy/` (history kept). "Source of truth" paths
      in FORMULAS.md and QA-ONBOARDING.md now point to `legacy/…`.
- [x] 0.2 `compose.yaml` + `compose.dev.yaml`: `postgres:18.6-alpine`,
      `dxflrs/garage:v2.4.1` + one-shot `storage-init` (layout, bucket, key) and `migrate`,
      `axllent/mailpit:v1.31.2` (dev), `caddy:2.11.4-alpine`, `api`, `web`.
      `deploy/caddy/Caddyfile`, `deploy/garage/garage.toml`, `deploy/postgres/initdb/`,
      `.env.example`.
- [x] 0.3 `apps/api` (Go 1.27.1): env config (fail fast), `slog`, chi + huma, `/healthz`,
      `/readyz` (DB + storage), graceful shutdown, subcommands `serve`, `migrate`,
      `storage-init`, `openapi`, `healthcheck`; first migration `00001_app_schema.sql`;
      distroless Dockerfile; `golangci-lint` config; unit tests + a testcontainers
      migration test.
- [x] 0.4 `apps/web` fresh on the architecture §5 versions. Copied `globals.css`,
      `components/ui`, `components/design-system` (+ stories; the nav trio waits for
      Phase 2.6), PWA manifest/icons/service worker. Query + nuqs providers, generated
      API types, a status page that renders `/readyz` server-side.
- [x] 0.5 `Makefile`: `up`, `infra`, `down`, `logs`, `ps`, `migrate`, `migrate-status`,
      `reset-db`, `gen`, `test`, `lint` (`seed` arrives with Phase 1.2). No root pnpm
      workspace — `apps/web` is the only JS package.
- [x] 0.6 CI `.github/workflows/rewrite-ci.yml`: api (golangci-lint, vet, `go test -race`
      with testcontainers, OpenAPI drift) + web (typed-client drift, typecheck, lint, test,
      build, Storybook) + Docker stack smoke test through Caddy. (`sqlc diff` joins when
      sqlc does, Phase 2.1.)
- [x] 0.7 CLAUDE.md + root README: new layout, `make` commands, per-app verify commands.
- **Gate**: `make up` → `http://localhost:8080` shows the status page (now at `/status`) with API, database,
  and storage healthy; Mailpit at `:8025`.

## Phase 1 — Clean schema + domain port (M)

- [x] 1.1 `apps/api/db/migrations/00002_baseline.sql`: the 40 legacy migrations replayed
      into Postgres 18 (with a scratch auth/storage shim), `pg_dump --schema-only`, then a
      mechanical rewrite per ADR-2: `public.users` replaces `auth.users`,
      `app.current_user_id()` replaces `auth.uid()`, `TO coachin_app` replaces
      `TO authenticated`, storage policies dropped. 28 tables, 23 functions (kept for
      Step A), 69 policies. `00003_reference_data.sql`: sport types + starter foods
      (legacy seeds, plus the core sports production had entered by hand).
- [ ] 1.2 → moved to Phase 2 (2.2): seeded users need real password hashes to log in.
- [x] 1.3 RLS tests (testcontainers, as `coachin_app`): every public table has RLS; a user
      sees only their own private rows and account; no user context → no rows.
      `store.WithUser` (transaction-local `app.user_id`) added here, used by everything
      after.
- [x] 1.4 `scripts/golden/generate.ts` (`make golden`, plain Node 22+ with a resolve hook for
      the legacy `@/` imports): runs the legacy `lib/*` functions over edge cases + seeded
      random inputs (clock pinned per case, `TZ=UTC`) → `testdata/golden/<topic>.json`. CI
      regenerates and fails on drift.
- [x] 1.5 Ported to `apps/api/internal/domain/`, each package replaying its legacy vectors:
      xp §1, streak §2, tiers §3, running §4, goals §6, scorecard / check-in / stall §7,
      dates §9, nutrition targets §10, quotas §11, workout sets / volume §12, supplements +
      meal adherence + food units + trends + grocery §8/§13, activity import §14, progress
      charts + photo nudge §15, schedule rows + country (`profile`). `jsnum` carries the
      JavaScript number/string semantics the formulas depended on.
      **Moved to Phase 3.3** (they live next to the AI adapter / training use case, not in
      `lib/`): race-intake gates §5 (`generatePlanAction`), AI `extract-json`,
      `schema-hint` (Gemini SDK types), `anchors` (prompt text).
      **Stay TypeScript, move to `apps/web/lib` with their vitest tests in Phase 3** (pure
      presentation): `share-card` (canvas + privacy rules, runs in the browser),
      `plan-items` labels, `plan-title`, `sports` (icon mapping), `week-days`,
      `training-day` (collision warning). `goal-achievements` does I/O → a Phase 3 use case.
- [x] 1.6 FORMULAS.md names the Go package next to every ported section.
- **Gate**: `go test ./...` passes every vector; RLS smoke test green.

## Phase 2 — Auth + platform slice (L)

API — PR 2A
- [x] 2.1 sqlc (`apps/api/sqlc.yaml`, `db/queries/*.sql` → `internal/store/queries`, CI
      `sqlc diff`). Instead of an owner-level `WithSystem`, auth runs on a dedicated
      `coachin_auth` pool (least privilege, ADR-3).
- [x] 2.2 `00004_auth.sql` (`app.sessions`, `app.auth_tokens`, `coachin_auth` grants,
      `password_hash` hidden from `coachin_app`); `app/auth`: argon2id + bcrypt-legacy
      verify/rehash, register (creates the profile), login, logout, verify email,
      forgot/reset/change password, `GET /me`; `adapters/mail` (SMTP → Mailpit locally);
      `api seed` + `make seed` (trainee + coach + relationship + routine; plans come with
      3.3).
- [x] 2.3 Middleware: session cookie → user, request ID, problem+json with the legacy
      messages, per-IP rate limits on auth endpoints, `http.CrossOriginProtection`, client
      IP from Caddy's `X-Forwarded-For` hop.
- [x] 2.4 Tests: full lifecycle on real Postgres, bcrypt→argon2id upgrade, validation
      messages, HTTP cookie/401/403/429 behavior; verified end to end on the compose
      stack through Caddy + Mailpit.

Web — PR 2B
- [x] 2.5 `lib/api/`: generated `schema.d.ts`, server client (`API_INTERNAL_URL` + forwarded
      cookie), browser client, `$api` (openapi-react-query), `getQueryClient()`,
      `QueryProvider` + `NuqsAdapter` in the root layout. `make gen` regenerates.
- [x] 2.6 Auth screens ported (login, register) + new (forgot, reset, verify, change
      password) with RHF + zod; `proxy.ts` cookie redirect; root page role routing via
      `GET /me`; app shell / nav with the community flag from `/me`. Done: `/` routes by
      role, the status page moved to `/status`, `(app)` layout checks the session,
      Profile has change password + logout; dashboard/coaching are placeholders until
      their Phase 3 slices. The proxy only checks for the cookie; login/register/forgot
      redirect a live session home after a real `/me` check (no stale-cookie loop).
- **Gate**: full auth journey works in the browser on the local stack.

## Phase 3 — Module slices (L, one PR per module)

Per module:
1. sqlc queries + `app/<module>` use cases (Step A: call the rewritten SQL functions
   inside `WithUser` where they exist).
2. huma handlers + integration tests covering the module's QA journey.
3. Port pages/components from `legacy/`: `page.tsx` prefetch + `HydrationBoundary`,
   `$api.useQuery` / `useMutation`, nuqs for URL state, stories for new DS components.
4. Port the module `README.md`; update QA-ONBOARDING for any flow that changed
   (auth screens, photo URLs).
- **Gate per module**: its QA journey passes on the local stack + a Playwright spec; all
  checks green.

Order (dependencies first, risk front-loaded):
- [x] 3.1 **Onboarding / My week** — sport types, schedules, weekly quotas, complete (S).
      `app/routine` + `GET /routine`, `/sport-types`, schedule/quota mutations; web page
      with prefetch + hydration, `useMutationFeedback`, `prefetchQueries`. Shared
      `apperr` (use-case errors → problem+json) and `domain/planitem` (lenient AI details).
- [x] 3.2 **Today** — `GET /today`, streak settle, workout log, supplements + logs,
      optimistic toggles (M)
  - [x] 3.2a Today core: `GET /today` (settles the streak via `evaluate_user_streak`),
        `POST /today/workouts` (log + ledger + balance in one transaction, once per sport
        per day), `PUT /plan-items/{id}/completion` (`complete_plan_item`, log window
        enforced in Go); migration `00005` lets the API write `xp_transactions`. Web
        Today page + shared `PlanItemRow` (optimistic); nav placeholders for Training,
        Calendar, Nutrition.
  - [x] 3.2b Daily supplements: `POST /supplements`, `PUT /supplements/{id}/schedule`,
        `DELETE /supplements/{id}`, `PUT /supplements/{id}/taken` (ownership checked);
        the stack with due/taken rides on `GET /today`. Migration `00006` adds the missing
        UPDATE policy (legacy schedule edits silently did nothing). Web card + manage
        sheet, optimistic check.
- [ ] 3.3 **Training** — AI adapters (Claude → Gemini, prompts verbatim; port `extract-json`,
      `schema-hint`, `anchors` with golden vectors), race-intake gates §5, plan generation,
      archive, plan-item completion, session logs, check-ins, FIT/GPX parse (L)
  - [x] 3.3a Programs page: `GET /training/programs` (week, race countdown, "by your coach",
        check-in due), `POST /training/plans/{id}/archive`, `GET /training/calendar.ics`
        (`domain/ics`, `planitem.DetailLine`/`VideoURL`); web `/training` + `lib/plan-title`;
        placeholders for `/training/new` and `/training/checkin`.
  - [x] 3.3b AI adapter `adapters/ai` (Claude streamed, Gemini schema-JSON fallback),
        `domain/aigen` (schema hint, extract-json, anchors, prompts, item validation —
        golden vectors `ai.json` captured from the legacy builders via stubbed SDK/provider
        modules), `POST /training/plans/{running,hypertrophy}` (`create_training_plan`,
        coach mode), `GET /training/intake-context`; web wizards + `lib/running` (replays
        `running.json`).
  - [x] 3.3d FIT/GPX parsing: `adapters/watchfile` (`muktihari/fit` v0.28.4; GPX via
        `encoding/xml` raw tokens shaped like fast-xml-parser's output) + `activity.FromTotals`,
        replaying `activity-files.json` (legacy parser run over generated fixtures —
        `make golden-activity`); `POST /activities/parse`; wizard "Watch data" step. The
        profile watch import reuses it in 3.6.
  - [x] 3.3c Session logs: `POST /plan-items/{id}/session-log` (insert + done + +10 XP in
        one tx, AI feedback non-fatal, flagged-note fallback persisted); weekly check-in:
        `GET/POST /training/plans/{id}/checkin` (scorecard, stalls, decision recomputed on
        confirm, AI week adjustment or "Keeping week N as planned", `apply_week_adjustment`
        +20 XP); `domain/aigen` feedback/adjustment ports (golden `ai.json`); web "Log
        details" sheet (RPE, run fields, per-set strength editor replaying
        `workout-sets.json`), check-in page, `components/ui/textarea`.
- [x] 3.4 **Calendar** — `GET /calendar?week=` (`app/calendar`: schedules in their date
      window, every active plan's week — plan and calendar weeks are both Monday-anchored,
      so one query covers the week — logged/done state, viewed-week quota progress,
      collision chip); web `/calendar`; the shared plan sheet/icon moved to
      `app/(app)/components`. ICS export shipped in 3.3a. Meal-plan line → 3.5.
- [x] 3.5 **Nutrition** — USDA proxy, meal logs, photo estimate + batch confirm, day/trends,
      meal plans (M)
  - [x] 3.5a Meal logging: `GET /nutrition/day` (meals, totals, goal, 7/30-day trends),
        `GET /foods`, `GET /foods/usda` (`adapters/usda`), `POST /meals` (local / USDA
        re-read by `fdcId` and stored once — migration 00007 `foods.fdc_id` — / manual;
        `award_meal_xp` + `award_day_adherence` in one tx under the profile lock),
        `DELETE /meals/{id}` (refunds the meal XP); web `/nutrition` (`lib/food-units`
        replays `nutrition.json`).
  - [x] 3.5b Photo estimate: `aigen.Request.Images` (Claude image blocks / Gemini inline
        data), `aigen.MealPhotoRequest` + `ParseMealEstimate` (golden `ai.json`, 15 new
        cases), `POST /meals/photo-estimate` (multipart, content-sniffed, profile country),
        `POST /meals/batch`; web Photo tab (device compression, review with search-to-add).
  - [x] 3.5c AI meal plan: `aigen.MealPlanRequest` + `ParseMealPlan` (golden `ai.json`),
        `app/nutrition.Plans` (`GET/POST/DELETE /nutrition/plan`, `POST
        /nutrition/plan/regenerate`; targets from FORMULAS §10, one-tx save that archives
        the old plan and sets the calorie goal), grocery list; `GET /today` `mealPlan`,
        `GET /calendar` `days[].meals` (+ adherence); web `/nutrition/plan`, Today's
        meals card, calendar meal line.
- [x] 3.6 **Profile** — profile/measurements, goals, activity import, photos (Garage
      adapter, pure-Go re-encode, Gemini moderation, streamed `GET /photos/{id}`),
      analyze / extract, `?tab=` (L)
  - [x] 3.6a Profile tabs (`?tab=`), `GET/PUT /me/body`, `PUT /me/nutrition-sharing`,
        `GET /me/overview` (join date, workouts, recent XP labels), `GET /me/progress`
        (charts from `domain/progress`, last 6 measurements), `POST/DELETE
        /measurements` (snapshot + goal settlement in one tx; `goals.Settle` baseline
        rule), `GET/POST /goals`, `POST /goals/{id}/abandon`; Today's goal strip;
        `components/ui/native-select`.
  - [x] 3.6b Watch-data import: `POST /activities/import` (`app/activities.Importer`:
        `activity.Sanitize` + `SplitImportable`, runs + ledger rows + XP in one tx under
        the profile lock); web Body tab "Watch data" (parse → review → log).
  - [x] 3.6c Photos: `objectstore` Put/Get/Delete, `adapters/imaging` (pure-Go decode
        JPEG/PNG/WebP, EXIF orientation, ≤1600 px, JPEG q82 — metadata dropped),
        `aigen.ModerationRequest` (+ `Request.Strict`: Gemini strict safety, Claude
        refusal → `Result.Blocked`), `app/photos` (analysis set batch, progress journal,
        cap-checked insert under the profile lock), `POST /photos`, `GET /photos`,
        streamed `GET /photos/{id}`, `DELETE /photos/{id}`; web Body photos + Progress
        photos (compare).
  - [x] 3.6d Consent-gated body analysis (`POST /photos/analyze`: consent stamped once,
        newest 5 body photos in one strict call, stored on the newest) and report
        extraction (`POST /photos/{id}/extract` → confirm as a measurement); `GET /photos`
        carries `analysis` + `consented`; `LatestBodyAnalysis` reads body photos only.
- [x] 3.7 **Coaching** — invite codes, join statuses, roster/adherence, consent-gated
      trainee nutrition/supplements, assign weekly plan, coach-mode plan generation (M)
      `app/coaching` (+ `domain/coaching.WeekStrip`, `supplements.Window`): `GET /coaching`
      (roster with the Monday-first strip, weekly XP via `get_weekly_leaderboard` for the
      coach's trainees only, per-plan current-week adherence), `GET /coaching/summary`,
      `POST /coaching/invite-codes`, `POST /coaching/join`,
      `POST /coaching/trainees/{id}/weekly-plan`, `GET /coaching/trainees/{id}/nutrition`
      (active relationship + sharing opt-in); web hub, trainee nutrition page, Today's
      coaching card, Profile → "My coach" (coach-mode generation shipped in 3.3).
- [x] 3.8 **Community** — clubs, follows, groups, leaderboard, discover; `404` while the
      flag is off (M)
  - [x] 3.8a Boards + clubs: `app/community` (weekly leaderboard — global / primary club /
        followed — with the lifetime-XP fallback; create / join / primary / leave),
        `communityOnly` middleware (404 while `FEATURE_COMMUNITY` is off); web
        `/community/boards`, `/community/clubs`. Leaderboard rows carry no email.
  - [x] 3.8b Circle: `community.CircleService` — `GET /community/circle` (following + my
        coaches), `GET /community/people?q=&page=` (name contains, wildcards literal, or an
        exact email; 10 per page; never returns email), `POST /community/follows`,
        `DELETE /community/follows/{id}`; web `/community/circle`.
  - [x] 3.8c Group streaks: `community.GroupsService` — `GET /community/groups` (settles
        each group's finished days first), `POST /community/groups`,
        `POST /community/groups/join`, `DELETE /community/groups/{id}/membership`,
        `GET /community/group-nudge`; migration 00008 (a new group settles from its 2nd
        member's join day, not yesterday); web `/community/groups` + Today's group nudge.
- [x] 3.9 **Share cards** (web only): `lib/share-card.ts` (card builders + privacy rules,
      tested), `lib/share-card-canvas.ts` (canvas, dark-theme tokens), design-system
      `share-card-sheet` / `share-button` (+ stories), `components/hooks/use-share-card.ts`;
      "Share it" (session log), "Share today" + meal share (nutrition), "Share progress"
      (progress compare).

## Phase 4 — Retire SQL business logic (M)

- [x] 4.1 Migration 00009: partial unique index `xp_transactions_once_idx (user_id,
      reason)` over every reason but the plan-item toggle pair (repeats by design:
      awards vs undos are counted) and legacy's undated `workout_log:<sportId>`; existing
      duplicates relabeled `#dup<n>` (amounts kept). The store maps a violation to the use
      case's "already logged" error (`store.awardedTwice`).
- [x] 4.2 Replace each SQL function with a Go use case in one transaction (Step B), one PR
      per group: plan items + session logs · meals + calorie day · goals · streak settle ·
      check-ins / week adjustment · coaching joins/assign · clubs/groups/leaderboard.
      Each gets a concurrency test (parallel duplicates → exactly one award).
  - [x] 4.2a Plan items + session logs: `planitem.CompletionXP` / `ToggleXP`,
        `xp.SessionLogXP`; `TrainingStore.SetPlanItemCompleted` (decision callback) and
        `CreateSessionLog` write the ledger under the profile lock — `complete_plan_item`
        / `award_session_log_xp` are no longer called (dropped in 4.3).
        `TestParallelAwardsPayOnce`.
  - [x] 4.2b Meals + calorie day + goals: `nutrition.MealAward` / `CalorieDayXP`
        (passed in as `appnutrition.MealRules`), `goals.AchievedXP`;
        `NutritionStore.LogMeals` and `ProfileStore.AddMeasurement` write the ledger —
        `award_meal_xp`, `award_day_adherence`, `achieve_goal` are no longer called.
  - [x] 4.2c Streak settle: `streak.Window` / `History.Required` / `SettleRange`;
        `TodayStore.SettleStreak(today)` reads the range's trained dates, schedules and
        active-plan slots once, under the profile lock — `evaluate_user_streak` is no
        longer called. `TestStreakSettleMatchesSQL` (3 seeded histories, SQL vs Go, 8
        parallel settles).
  - [x] 4.2d Weekly check-ins: `TrainingStore.ApplyWeekAdjustment` (check-in row,
        week-scoped rewrite keeping item descriptions, `xp.WeeklyCheckinXP` once) —
        `apply_week_adjustment` is no longer called; 8 parallel confirms → one +20.
  - Cross-user functions stay `SECURITY DEFINER` primitives (ADR-5 amendment):
    coach / club / group joins by code, `assign_coach_schedule_to_student`,
    `evaluate_group_days`, `group_trained_today`, `get_weekly_leaderboard` — and the
    ones that grant membership or write another user's rows: `create_club_with_owner`,
    `create_training_group`, `leave_training_group` (deletes the emptied group), and
    `create_training_plan` (coach mode writes the trainee's plan). The app role has no
    insert policy on `club_members` / `group_members` / `training_groups` for good reason.
- [x] 4.3 Migration 00010 drops the 7 retired functions (`complete_plan_item`,
      `award_session_log_xp`, `award_meal_xp`, `award_day_adherence`, `achieve_goal`,
      `evaluate_user_streak`, `apply_week_adjustment`); its Down restores them. The streak
      parity test installs legacy's function from `internal/store/testdata`.
- [x] 4.4 FORMULAS.md: Go files are the only source of truth — every section names its
      Go code; `legacy/` paths are "Legacy origin" history. `testdata/golden` is owned by
      the Go + web tests (edited with a formula change); CI no longer regenerates it from
      the legacy TypeScript.
- **Gate**: full suites + golden vectors + every QA journey re-run.

## Phase 5 — Hardening & cutover in the repo (M)

- [x] 5.1 Playwright suite for QA journeys 1–8 against the compose stack, in CI.
  - [x] 5.1a `apps/web/e2e` + `compose.e2e.yaml` (fake Claude, Community on) + `make e2e`
        + CI job "E2E journeys": journeys 0, 2, 3, 5 (+ share card), 6, 9, 10. It caught a
        real bug: `<main>` in the app shell lacked `min-w-0`, so a long email in a page
        header widened the whole phone layout (fixed).
  - [x] 5.1b journeys 1 (my week), 4 (calendar), 7 (watch import — GPX generated relative
        to today), 8 (progress photos drawn on a canvas → compare → share card). 14 tests.
- [x] 5.2 Security review of auth, uploads, authorization, and fixes —
      [`security-review.md`](security-review.md): profiles private (cards view for
      others), leaderboard without emails, clubs members-only, edge security headers.
- [ ] 5.3 Delete `legacy/` (and with it `supabase/`, Vercel/Next server code). Verify spec
      §8 criteria 1–7. Rewrite root README (stack, `make up`), QA-ONBOARDING ("Stack",
      "Running the app locally"), module READMEs.

## Phase 6 — VPS readiness (M)

- [ ] 6.1 Release workflow: build `api` + `web` images (amd64 + arm64) → GHCR on tag.
- [ ] 6.2 Production Caddyfile (domain, automatic HTTPS, security headers, gzip/zstd),
      production `.env` template, `__Host-` secure cookie.
- [ ] 6.3 Backups: nightly `pg_dump` + Garage bucket sync to off-site storage, 14-day
      retention; `make restore` + a tested restore runbook in `deploy/README.md`.
- [ ] 6.4 VPS bootstrap runbook: Ubuntu LTS, Docker Engine, non-root deploy user, SSH
      key-only, firewall (22/80/443), unattended security upgrades, `make deploy`.

## Phase 7 — Go-live (S–M)

- [x] 7.1 `api import-supabase` (one-time; `make import-supabase [ARGS=-dry-run]`): users
      (UUID, email, bcrypt hash, verified date), all shared public tables, storage objects
      → Garage; refuses a non-empty target. `TestImportSupabase`. Runbook:
      `deploy/README.md`. The dry run against a production snapshot happens in 7.2.
- [ ] 7.2 Provision the VPS (Phase 6 runbook), point DNS, deploy, import production data
      during a short maintenance window.
- [ ] 7.3 Smoke-test every QA journey on the live domain; old users log in with their
      existing passwords.
- [ ] 7.4 Switch off Vercel and Supabase after a safe period (keep a final Supabase dump
      archived). Delete the `import-supabase` command.

---

## Working agreements for every PR

- **Branching**: all rewrite work merges into `feat/backend-rewrite-with-go` (the rewrite's
  mother branch, cut from `develop` on 2026-09-24). `main` and `develop` keep the current
  Vercel + Supabase app untouched. Each task gets a short-lived branch off the mother
  branch and a PR back into it.
- One module or concern per PR; `main` always builds and `make up` always works.
- Before commit: `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed>`, `pnpm test`,
  `go vet ./...`, `golangci-lint run`, `go test ./...` — never commit on red.
- Same change updates: module `README.md`, `QA-ONBOARDING.md`, `FORMULAS.md` (if math
  moved), `WORKLOG.md` entry.
- No new features ride along; visual diffs from upgrades are fixed, not accepted.

## Immediate next step

Confirm the spec §10 defaults, then start Phase 0 (0.1 → 0.4 in one PR).
