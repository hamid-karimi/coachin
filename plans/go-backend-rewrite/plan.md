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
- **Gate**: `make up` → `http://localhost:8080` shows the status page with API, database,
  and storage healthy; Mailpit at `:8025`.

## Phase 1 — Clean schema + domain port (M)

- [ ] 1.1 `apps/api/db/migrations/00002_baseline.sql`: replay `legacy/supabase/migrations` into a
      scratch Postgres, `pg_dump --schema-only`, then clean it per ADR-2 (`users` table,
      `app.current_user_id()`, `coachin_owner`/`coachin_app` roles, no `auth`/`storage`
      schemas). `00003_auth.sql`: `sessions`, `auth_tokens`.
- [ ] 1.2 `apps/api/db/seed/` + `make seed`: sport types (from the seed migration), a trainee, a coach, an active
      relationship, one running plan, one hypertrophy plan.
- [ ] 1.3 RLS smoke test (testcontainers): as `coachin_app` with user A, every table read
      returns zero rows of user B.
- [ ] 1.4 `scripts/export-golden.ts` (runs in `legacy/`): pure `lib/*` functions over the
      inputs in `lib/*.test.ts` → `testdata/golden/<topic>.json`.
- [ ] 1.5 Port to `apps/api/internal/domain/` with table-driven tests on the vectors: xp §1 ·
      streak §2 · tiers §3 · running §4 · race intake §5 · goals §6 · scorecard / check-in /
      stall §7 · nutrition §8/§10 · plan weeks & dates §9 · quotas §11 · volume §12 ·
      supplements + meal adherence §13 · activity summary §14 · charts + photo nudge §15 ·
      plan-items, schedule-inserts, food-units, grocery, share-card privacy, sports,
      user-country, AI extract-json / schema-hint / anchors.
- [ ] 1.6 FORMULAS.md: add the Go path next to each "source of truth".
- **Gate**: `go test ./...` passes every vector; RLS smoke test green.

## Phase 2 — Auth + platform slice (L)

API
- [ ] 2.1 `store`: pgx pool as `coachin_app`, `WithUser` / `WithSystem`, sqlc setup.
- [ ] 2.2 `app/auth`: argon2id + bcrypt-legacy verify/rehash, sessions, register, login,
      logout, verify email, forgot/reset/change password, `GET /me`. `mail` adapter with
      HTML + text templates (Mailpit locally).
- [ ] 2.3 Middleware: session → user, request ID, problem+json, rate limits, 8 MB body cap.
- [ ] 2.4 Integration tests: register → email in Mailpit → verify → logout → login →
      forgot → reset → old sessions revoked; rate limits trigger; cross-user access denied.

Web
- [ ] 2.5 `lib/api/`: generated `schema.d.ts`, server client (`API_INTERNAL_URL` + forwarded
      cookie), browser client, `$api` (openapi-react-query), `getQueryClient()`,
      `QueryProvider` + `NuqsAdapter` in the root layout. `make gen` regenerates.
- [ ] 2.6 Auth screens ported (login, register) + new (forgot, reset, verify, change
      password) with RHF + zod; `proxy.ts` cookie redirect; root page role routing via
      `GET /me`; app shell / nav with the community flag from `/me`.
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
- [ ] 3.1 **Onboarding / My week** — sport types, schedules, weekly quotas, complete (S)
- [ ] 3.2 **Today** — `GET /today`, streak settle, workout log, supplements + logs,
      optimistic toggles (M)
- [ ] 3.3 **Training** — AI adapters (Claude → Gemini, prompts verbatim), plan generation,
      archive, plan-item completion, session logs, check-ins, FIT/GPX parse (L)
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

- [ ] 4.1 Migration: unique index `xp_transactions (user_id, reason)`.
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
