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
  - [ ] 3.3d FIT/GPX parsing (`muktihari/fit`, `encoding/xml`) for the running wizard's
        upload step and the profile watch import.
  - [x] 3.3c Session logs: `POST /plan-items/{id}/session-log` (insert + done + +10 XP in
        one tx, AI feedback non-fatal, flagged-note fallback persisted); weekly check-in:
        `GET/POST /training/plans/{id}/checkin` (scorecard, stalls, decision recomputed on
        confirm, AI week adjustment or "Keeping week N as planned", `apply_week_adjustment`
        +20 XP); `domain/aigen` feedback/adjustment ports (golden `ai.json`); web "Log
        details" sheet (RPE, run fields, per-set strength editor replaying
        `workout-sets.json`), check-in page, `components/ui/textarea`.
- [ ] 3.4 **Calendar** — `GET /calendar?week=`, ICS endpoint (S)
- [ ] 3.5 **Nutrition** — USDA proxy, meal logs, photo estimate + batch confirm, day/trends,
      meal plans (M)
- [ ] 3.6 **Profile** — profile/measurements, goals, activity import, photos (Garage
      adapter, pure-Go re-encode, Gemini moderation, streamed `GET /photos/{id}`),
      analyze / extract, `?tab=` (L)
- [ ] 3.7 **Coaching** — invite codes, join statuses, roster/adherence, consent-gated
      trainee nutrition/supplements, assign weekly plan, coach-mode plan generation (M)
- [ ] 3.8 **Community** — clubs, follows, groups, leaderboard, discover; `404` while the
      flag is off (M)

## Phase 4 — Retire SQL business logic (M)

- [ ] 4.1 Migration: unique index `xp_transactions (user_id, reason)`. Imported legacy
      rows repeat reasons (`workout_log:<sportId>` has no date; `plan_item:<id>` repeats
      after an undo) — rewrite them to unique keys (or index only new-format reasons)
      before creating the index.
- [ ] 4.2 Replace each SQL function with a Go use case in one transaction (Step B), one PR
      per group: plan items + session logs · meals + calorie day · goals · streak settle ·
      check-ins / week adjustment · coaching joins/assign · clubs/groups/leaderboard.
      Each gets a concurrency test (parallel duplicates → exactly one award).
- [ ] 4.3 Migration dropping retired functions (keep `sync_league_tier` and photo-cap
      triggers).
- [ ] 4.4 FORMULAS.md: Go files are the only source of truth.
- **Gate**: full suites + golden vectors + every QA journey re-run.

## Phase 5 — Hardening & cutover in the repo (M)

- [ ] 5.1 Playwright suite for QA journeys 1–8 against the compose stack, in CI.
- [ ] 5.2 Security review of auth, uploads, authorization (`/security-review`), and fixes.
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

- [ ] 7.1 `cmd/import-supabase` (one-time): users (UUID, email, bcrypt hash, verified
      date), all public tables, storage objects → Garage. Dry run against a production
      snapshot locally; verify counts + spot-check XP/streaks/photos.
- [ ] 7.2 Provision the VPS (Phase 6 runbook), point DNS, deploy, import production data
      during a short maintenance window.
- [ ] 7.3 Smoke-test every QA journey on the live domain; old users log in with their
      existing passwords.
- [ ] 7.4 Switch off Vercel and Supabase after a safe period (keep a final Supabase dump
      archived). Delete `cmd/import-supabase`.

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
