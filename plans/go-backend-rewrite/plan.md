# Plan — Go backend rewrite

Spec: [`spec.md`](spec.md) · Architecture: [`architecture.md`](architecture.md)

Strategy: **strangler, module by module**. The app keeps working after every phase; each
module flips from server actions to the Go API in its own PR. Nothing is deleted until its
replacement is live and tested.

Sizing: **S** ≈ one focused session · **M** ≈ 2–3 · **L** ≈ 4+.

---

## Phase 0 — Foundations (M)

Goal: monorepo, empty-but-deployable Go API, database under goose, CI green.

- [ ] 0.1 `git mv` the Next app into `apps/web/` (keep history); root `pnpm-workspace.yaml`
      → `apps/web`; fix Storybook/vitest/tsconfig paths. Behavior unchanged. **Gate**: tsc,
      eslint, vitest, `next build` green.
- [ ] 0.2 Upgrade web deps to the architecture §6 matrix in one commit (Next 16.3.6,
      React 19.3, TS 6.0.3, Tailwind 4.3.3, Storybook 10.6, vitest 5, ESLint 10). Fix
      breakages only. **Gate**: same as 0.1 + Storybook build.
- [ ] 0.3 Scaffold `apps/api` (Go 1.27.1): `cmd/api` with config, `slog`, chi + huma,
      `/healthz`, `/readyz`, graceful shutdown, `openapi` subcommand. Dockerfile
      (distroless). `golangci-lint` config.
- [ ] 0.4 `db/migrations`: `00001_baseline.sql` from `pg_dump --schema-only` of prod
      (public schema + storage bucket row + policies); `00002_auth_compat.sql`
      (`auth.uid()`, `authenticated` role — no-op on Supabase). Mark baseline applied on
      prod (`goose` version table) without running it.
- [ ] 0.5 Local dev: `compose.yaml` (Postgres 17 + MinIO), `make dev` runs API + web,
      seed script with one trainee, one coach, one active relationship.
- [ ] 0.6 CI workflow: web (tsc/eslint/vitest/build) + api (lint, `go test` with
      testcontainers, `sqlc diff`, OpenAPI drift check).
- [ ] 0.7 Update `CLAUDE.md` "Verify before every commit" with the Go commands
      (`go vet ./...`, `golangci-lint run`, `go test ./...`).

## Phase 1 — Domain port with golden vectors (M)

Goal: every FORMULAS.md section has one Go implementation proven equal to today's TS.

- [ ] 1.1 Script `scripts/export-golden.ts`: runs the pure `lib/*` functions over the
      inputs already used in `lib/*.test.ts` and writes `testdata/golden/<topic>.json`.
- [ ] 1.2 Port to `apps/api/internal/domain/`, table-driven tests reading the vectors:
      `xp` §1 · `streak` §2 · `tiers` §3 · `running` §4 · race intake gates §5 · `goals` §6
      · `scorecard` + check-in decision + stall detection §7 · nutrition §8/§10 · plan
      weeks & dates §9 · weekly quotas §11 · workout volume §12 · supplements + meal
      adherence §13 · activity import summary §14 · progress charts + photo nudge §15 ·
      `plan-items`, `schedule-inserts`, `food-units`, `meal-plan-grocery`, `share-card`
      privacy rules, `sports`, `user-country`, AI `extract-json` / `schema-hint` / anchors.
- [ ] 1.3 FORMULAS.md: add the Go path next to each TS "source of truth" (both valid
      until Phase 4).
- **Gate**: `go test ./internal/domain/...` passes every vector; vitest still green.

## Phase 2 — Platform slice: store, auth, contract, web data layer (L)

Goal: a logged-in user's `/me` flows browser → Next → Go → Postgres with RLS on.

API
- [ ] 2.1 `store`: pgx pool, `WithUser(ctx, uid, fn)` tx that sets role + claims
      (ADR-4), `WithSystem`; sqlc config + first queries (`profiles`).
- [ ] 2.2 Migration: `sessions` table. `app/auth` with `CredentialStore` interface +
      `supabaseCredentials` (GoTrue signup / password grant). Endpoints
      `POST /auth/register|login|logout`, `GET /me`. Cookie per ADR-3; same password rules.
- [ ] 2.3 Middleware: session → user, request ID, problem+json errors, rate limits on
      `/auth/*`, body limit 8 MB.
- [ ] 2.4 Integration tests (testcontainers): register → login → `/me` → logout; RLS
      denies cross-user reads even if a handler forgets a check.

Web
- [ ] 2.5 `lib/api/`: generated `schema.d.ts`, `openapi-fetch` clients (browser: `/api`,
      server: `API_INTERNAL_URL` + forwarded cookie), `openapi-react-query` `$api`,
      `getQueryClient()` (request-scoped on server, singleton in browser),
      `QueryProvider` + `NuqsAdapter` in `app/layout.tsx`.
- [ ] 2.6 `next.config.ts` rewrite `/api/:path*` → API. `pnpm gen:api` script.
- [ ] 2.7 Port auth pages to the API (RHF + zod forms, `useMutation`); `proxy.ts` checks
      the session cookie instead of Supabase; root page role routing uses `GET /me`.
- **Gate**: existing users log in through Go (v1 credentials); logout revokes the session.
      Transitional bridge until 5.3: the login/logout server actions also keep the Supabase
      session (`signInWithPassword` / `signOut`) and relay the Go `Set-Cookie`, so
      not-yet-ported pages keep working.

## Phase 3 — Module slices (L, one PR per module)

Per module, the same recipe:
1. sqlc queries + `app/<module>` use cases (Step A: call existing RPCs inside `WithUser`).
2. huma handlers + integration tests covering the module's QA journey steps.
3. Regenerate client; page prefetches + `HydrationBoundary`; client leaves switch to
   `$api.useQuery` / `useMutation`; nuqs for URL state.
4. Delete the module's server actions / route handlers; update its `README.md` and
   `QA-ONBOARDING.md`.
- **Gate per module**: its QA journey passes manually + Playwright spec; tsc/eslint/vitest
  and go tests green.

Order (dependencies first, risk front-loaded):
- [ ] 3.1 **Onboarding / My week** — sport types, schedules, weekly quotas, complete (S)
- [ ] 3.2 **Today** — `GET /today`, streak settle, workout log, supplements + logs,
      optimistic toggles (M)
- [ ] 3.3 **Training** — plan generation (AI adapters: Claude→Gemini, prompts verbatim),
      archive, plan-item completion, session logs, check-ins, FIT/GPX parse (L)
- [ ] 3.4 **Calendar** — `GET /calendar?week=` (nuqs `week`), ICS endpoint (S)
- [ ] 3.5 **Nutrition** — USDA foods proxy, meal logs, photo estimate + batch confirm,
      day/trends, meal plans (M)
- [ ] 3.6 **Profile** — profile/measurements, goals, activity import, photos: object
      storage adapter, pure-Go re-encode + Gemini moderation, signed URLs, analyze /
      extract; nuqs `tab` (L)
- [ ] 3.7 **Coaching** — invite codes, join (status mapping), roster/adherence,
      consent-gated trainee nutrition/supplements, assign weekly plan, coach-mode plan
      generation (`?student=`) (M)
- [ ] 3.8 **Community** — clubs, follows, groups, leaderboard, discover; `404` while flag
      off (M)

## Phase 4 — Retire SQL business logic (M)

- [ ] 4.1 Migration: unique index `xp_transactions (user_id, reason)` (dedupe check first).
- [ ] 4.2 Replace each RPC call with a Go use case in one tx (Step B, ADR-5), one PR per
      group: plan items + session logs · meals + calorie day · goals · streak settle ·
      check-ins / week adjustment · coaching joins/assign · clubs/groups/leaderboard.
      Concurrency test per use case (parallel duplicate requests → one award).
- [ ] 4.3 Migration dropping the retired functions (`sync_league_tier` trigger and
      `enforce_body_photo_cap` stay — they are invariants, not business flows).
- [ ] 4.4 FORMULAS.md: Go files become the only "source of truth"; delete TS formula
      copies no longer used by the UI.
- **Gate**: full go + vitest suites; golden vectors; every QA journey re-run.

## Phase 5 — Cutover & cleanup (M)

- [ ] 5.1 Playwright suite for QA journeys 1–8 against web + API + Postgres in CI.
- [ ] 5.2 Deploy API (container host) + web (Vercel) with `API_INTERNAL_URL`; staging
      soak against a prod snapshot.
- [ ] 5.3 Stop setting the Supabase session cookie; remove `@supabase/*`, `sharp`, AI SDKs,
      `@garmin/fitsdk`, `fast-xml-parser` from `apps/web`; remove Supabase env vars from
      web.
- [ ] 5.4 Verify spec §8 acceptance criteria 1–6; update root README, QA-ONBOARDING
      ("Stack", "Running the app locally"), module READMEs.

## Phase 6 — Leave Supabase auth & storage (optional, M)

- [ ] 6.1 `nativeCredentials`: bcrypt verify from `auth.users.encrypted_password`, rehash
      to argon2id into `credentials`; flip `CredentialStore`. Password reset + email
      confirmation via a transactional email provider.
- [ ] 6.2 Copy `body_photos` objects to the new S3-compatible bucket; switch endpoint.
- [ ] 6.3 Drop FKs to `auth.users` in favor of our `users` table (same UUIDs); Postgres can
      then move to any host with only a `DATABASE_URL` change.

---

## Working agreements for every PR in this plan

- One module or one concern per PR; each leaves main deployable.
- Before commit: `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed>`, `pnpm test`,
  `go vet ./...`, `golangci-lint run`, `go test ./...` — never commit on red.
- Same change updates: module `README.md`, `QA-ONBOARDING.md`, `FORMULAS.md` (if math
  moved), `WORKLOG.md` entry.
- No new features ride along; UX diffs caused by upgrades are fixed, not accepted.

## Immediate next step

Approve or amend the spec's open questions (§10) and the ADRs, then start Phase 0.1–0.3.
