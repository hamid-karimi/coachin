# Architecture — Go API + frontend-only Next.js, self-hosted with Docker

Status: **Proposed** · Date: 2026-09-24 · Spec: [`spec.md`](spec.md) · Plan: [`plan.md`](plan.md)

## 1. Target shape

One Docker Compose project. Locally on macOS it listens on `http://localhost:8080`; on the
VPS the same stack sits behind real HTTPS on your domain.

```
                         browser
                            │
                            ▼
                ┌──────── caddy ────────┐   local: :8080 (http)
                │ /api/*  → api:8080    │   VPS:   :443 (automatic HTTPS)
                │ /*      → web:3000    │
                └───────┬───────┬───────┘
                        │       │
          ┌─────────────▼─┐   ┌─▼──────────────────────────────────────────────┐
          │ web           │   │ api  (Go 1.27, single static binary)           │
          │ Next.js 16.3  │──▶│ transport/http  chi + huma (OpenAPI 3.1)       │
          │ SSR + TanStack│   │ app/<module>    use cases                      │
          │ Query + nuqs  │   │ domain          pure formulas (FORMULAS.md)    │
          └───────────────┘   │ store           sqlc on pgx, RLS user context  │
      server-side calls go    │ adapters        ai · media · importer · mail · │
      straight to api:8080    │                 objectstore · usda             │
                              └──┬──────────────┬──────────────┬───────────────┘
                                 ▼              ▼              ▼
                           postgres 18     garage (S3 API)   mailpit (local) /
                           (RLS on)        photos bucket     SMTP provider (VPS)
                                                              + Claude / Gemini / USDA
```

- Only Caddy publishes a port. Postgres, Garage, and the API are reachable only on the
  internal Docker network (Mailpit's UI is published locally for reading test emails).
- The browser only ever talks to one origin, so there is no CORS and the session cookie is
  host-only.
- Dependencies point inward (`coding-style` §10): `transport → app → domain`; `store` and
  `adapters` implement interfaces declared by `app`; `domain` imports only the stdlib.

## 2. Repository layout (monorepo)

```
apps/
  web/                 Next.js app (fresh scaffold on latest versions; UI code
                       ported from legacy/); own pnpm lockfile — no root workspace
  api/
    cmd/api/           one binary: serve · migrate · storage-init · openapi · healthcheck
    cmd/import-supabase/  one-time importer used at go-live (then deleted)
    db/migrations/     goose SQL migrations, embedded in the binary
    db/seed/           local seed data (trainee, coach, relationship, sample plans)
    internal/
      config/          env → typed config, fail fast listing every missing variable
      domain/          xp, streak, tiers, running, goals, scorecard, nutrition, dates,
                       quotas, supplements, plan items, share rules … (+ *_test.go)
      app/             auth, onboarding, today, training, nutrition, profile, coaching,
                       community
      store/           pgx pool, migrator, sqlc output, tx.go (RLS context), queries/*.sql
      transport/httpapi/  handlers per module, middleware, problem+json
      adapters/        ai/, garage/ (bootstrap), media/, importer/, mail/, objectstore/, usda/
    sqlc.yaml
    Dockerfile
deploy/
  caddy/Caddyfile      one site block; SITE_ADDRESS switches local http ↔ VPS https
  garage/garage.toml   single-node Garage config
  postgres/initdb/     creates the coachin_app role on first boot
testdata/golden/       JSON vectors shared by vitest (during transition) and go test
openapi/openapi.json   emitted by the API, committed, CI drift check
legacy/                today's Next.js + Supabase app, read-only reference; deleted at cutover
compose.yaml           the whole stack (what the VPS runs)
compose.dev.yaml       local-only: hot reload, Mailpit, Postgres port
Makefile               up · infra · down · logs · ps · migrate · reset-db · gen · test · lint
.github/workflows/rewrite-ci.yml
FORMULAS.md, QA-ONBOARDING.md, WORKLOG.md, CLAUDE.md, README.md
```

## 3. Architecture decisions (ADRs)

### ADR-1 — Go HTTP stack: chi + huma
- **Decision**: `go-chi/chi/v5` for routing and middleware, `danielgtaylor/huma/v2` on top
  for typed handlers that **generate OpenAPI 3.1** from Go structs and validate requests.
- **Why**: a code-first contract with no hand-written YAML; plain `net/http`; multipart
  and streaming responses (ICS, images) are supported.
- **Rejected**: gRPC/Connect (friction for browser + SSR at this size); spec-first
  generation (two sources of truth while the domain is being ported).

### ADR-2 — Database: PostgreSQL 18, pgx + sqlc + goose, clean schema
- **Decision**: `jackc/pgx/v5` pool; `sqlc` generates typed Go from SQL files; `goose`
  runs migrations embedded in the API binary. A one-shot `migrate` service (`api migrate
  up`, owner role) runs before the API starts — the same path locally and on the VPS.
- **`00001_app_schema.sql`** (Phase 0): the `app` schema, `app.current_user_id()`, and
  default grants to `coachin_app`.
- **Clean baseline**: `00002_baseline.sql` is produced from the 40 Supabase migrations,
  then cleaned of every Supabase artifact:
  - `auth.users` → our own `users` table (`id uuid`, `email citext unique`,
    `password_hash`, `email_verified_at`, timestamps); every FK retargeted, UUIDs kept.
  - `auth.uid()` → `app.current_user_id()`; `authenticated` role → `coachin_app`.
  - `storage.*` schema and bucket policies removed (access is enforced by the API).
  - New tables (`00004_auth.sql`, Phase 2): `sessions`, `auth_tokens` (verify / reset,
    hashed, single-use).
- **`00003_reference_data.sql`**: sport types and the starter food catalogue. Production's
  rows (with their ids) replace them at import.
- **Roles**: `coachin_owner` owns the schema and runs migrations; the API connects as
  `coachin_app` (not owner), so RLS applies to it, and as `coachin_auth` for login and
  registration only (see ADR-3). `coachin_app` can read `users` minus `password_hash`.
- **Why**: SQL stays SQL; compile-time-checked queries; no ORM; nothing Supabase-shaped left.

### ADR-3 — Auth: built into the API
- **Passwords**: argon2id (`golang.org/x/crypto/argon2`, OWASP parameters). Users imported
  from Supabase keep their **bcrypt** hash; on successful login it is verified with bcrypt
  and transparently rehashed to argon2id. Nobody has to reset their password.
- **Sessions**: opaque 256-bit random token in a cookie (`HttpOnly`, `SameSite=Lax`,
  `Secure` + `__Host-` prefix on the VPS; plain `coachin_session` over local http). Only
  the token's SHA-256 is stored in `app.sessions`; 30-day sliding expiry (extended at most
  hourly); logout, password reset, and password change revoke sessions instantly.
- **`coachin_auth` role**: login and registration happen before a user context exists, so
  they can't run under RLS as `coachin_app`. A separate pool connects as `coachin_auth`
  (`BYPASSRLS`, but granted only `users`, profile insert/summary columns, and the `app`
  schema's `sessions` / `auth_tokens`). `coachin_app` cannot read `app.*` at all.
- **Email flows**: verification and password-reset links carry single-use tokens (hashed in
  `auth_tokens`, 7 d / 1 h expiry). Sent through the `mail` adapter over SMTP
  (`wneessen/go-mail`): Mailpit locally, any SMTP provider on the VPS.
- **Abuse limits**: per-IP and per-email rate limits on login, register, forgot-password;
  constant-time comparisons; generic "invalid email or password" messages.
- **CSRF**: same origin + `SameSite=Lax` + Go's `http.CrossOriginProtection`, which
  rejects cross-site state-changing requests by `Sec-Fetch-Site` / `Origin`.
- **Client IP** (rate limits, session records): the last `X-Forwarded-For` hop, which
  Caddy appends; earlier hops are client-supplied and ignored.
- **Why not an auth server** (Keycloak, Zitadel, Ory…): one more heavy service to run on a
  small VPS for a feature set this app doesn't need (no SSO, no OAuth providers today).
  Revisit if social login is ever wanted.

### ADR-4 — Authorization: explicit in Go, RLS kept as a safety net
- **Decision**: every request's DB work runs inside `store.WithUser(ctx, uid, fn)`:
  ```sql
  BEGIN;
  SELECT set_config('app.user_id', '<uuid>', true);   -- transaction-local
  -- queries…
  COMMIT;
  ```
  `app.current_user_id()` returns `current_setting('app.user_id', true)::uuid`, so the 92
  existing policies keep enforcing after the mechanical rename. Use cases also check
  permissions explicitly (e.g. `coaching.RequireActiveRelationship`) — that's what the
  tests assert.
- **Why**: a forgotten check in Go fails closed instead of leaking another user's data.
- `store.WithSystem` (owner role, no RLS) is reserved for migrations, the importer, and
  future background jobs.

### ADR-5 — Business logic: one Go implementation, SQL functions retired
- **Step A** (fast parity): Go use cases call the existing SQL functions
  (`complete_plan_item`, `award_meal_xp`, …, rewritten to `app.current_user_id()`).
- **Step B**: move each function's logic into `domain` + a use case in one transaction,
  then drop the SQL function.
- **Idempotency**: unique index on `xp_transactions (user_id, reason)`;
  `INSERT … ON CONFLICT DO NOTHING` + rows-affected check. Plan-item undo keeps its
  compensating `plan_item_undo:<id>` transaction.
- **Concurrency**: streak settle and group-day evaluation lock the profile / group row
  (`SELECT … FOR UPDATE`).
- **Kept in SQL**: true invariants only — `sync_league_tier` trigger, photo-cap trigger.
- **Amendment (Phase 4.2, 2026-09-25)**: functions that act **across users** stay as
  narrow `SECURITY DEFINER` primitives — redeeming a coach / club / group invite code
  (the caller reads another user's code and joins their row), a coach replacing a
  trainee's schedule, group-day evaluation (pays every member), `group_trained_today`,
  and `get_weekly_leaderboard`. Under ADR-4 a request runs as its user with RLS on, and
  `WithSystem` is reserved for migrations / importer / jobs, so moving these into Go
  would need either RLS policies that expose other users' rows (e.g. every invite code)
  or a request-time RLS bypass — both weaker than a function that does exactly one
  cross-user step. Their XP rules stay pinned by Go-side tests; everything that touches
  only the caller's rows is Step B (4.2a–d, plan creation, club / group creation and
  leaving).
- **Parity**: `testdata/golden/*.json` generated from today's `lib/*.test.ts` cases; Go runs
  the same vectors. FORMULAS.md pointers move to `apps/api/internal/domain/*.go`.

### ADR-6 — Frontend ↔ API: one origin via Caddy
- Browser → Caddy → `/api/*` to the API, everything else to Next.js.
- Server Components call `http://api:8080` directly (`API_INTERNAL_URL`) and forward the
  incoming `cookie` header — no round trip through Caddy.
- Next.js has **no** rewrites, no route handlers, no server actions that write data;
  `proxy.ts` only checks for the session cookie to redirect to `/auth/login` early.

### ADR-7 — Frontend data layer: generated client + TanStack Query + nuqs
- **Typed client**: `openapi-typescript` → `apps/web/lib/api/schema.d.ts`;
  `openapi-fetch` fetcher; `openapi-react-query` for `$api.useQuery('get', '/today')` /
  `$api.useMutation(...)`. No hand-written fetchers or response types.
- **SSR**: `page.tsx` (orchestration only) creates a request-scoped `QueryClient`,
  prefetches with the server client, renders `<HydrationBoundary state={dehydrate(qc)}>`.
- **Mutations**: `useMutation` + targeted `invalidateQueries`; optimistic plan-item and
  supplement toggles. `useActionToast` becomes `useMutationToast` over the same
  `{status, message}` shape.
- **URL state**: `nuqs` with `NuqsAdapter`; parsers in `lib/search-params.ts`, read on the
  server with `createSearchParamsCache`.
- **Forms**: `react-hook-form` + `zod` 4 for UX validation; the API is authoritative and
  returns field errors in problem+json `errors[]`.
- **Unchanged**: design system, Tailwind tokens, Storybook, share-card canvas, PWA.

### ADR-8 — Object storage: Garage (S3 API), never public
- **MinIO status**: the community edition went maintenance-only (security fixes only) and
  is distributed as source — no official pre-built binaries or Docker images. Not a good
  base for a new project.
- **Decision**: **Garage** (`dxflrs/garage` v2.4.1), single node, replication factor 1.
  Lightweight, stable, built for self-hosting on small
  servers, S3-compatible for everything this app needs (put / get / delete, presign).
  AGPL applies only if you modify Garage itself — running it unmodified as a separate
  container is fine.
- **Alternatives considered**:
  | Option | Verdict |
  | --- | --- |
  | RustFS 1.0.0 | Closest MinIO look-alike (console UI, Apache 2.0) but 1.0 shipped 2026-09-16 — too fresh; good candidate later |
  | SeaweedFS | Mature and fast, but more moving parts (master/volume/filer) than one VPS needs |
  | Local disk only | Simplest, but loses the S3 API that lets us move to managed storage later |
  | Managed S3 (Hetzner Object Storage, Cloudflare R2, Backblaze B2) | Great for the VPS phase if you'd rather not run storage — config change only |
- **Access model**: the bucket is private and never exposed through Caddy. The API streams
  photos (`GET /api/v1/photos/{id}`) after checking access (owner, or active coach), with
  `Cache-Control: private`. Photos are small re-encoded JPEGs, so this is cheap and avoids
  presigned-URL host issues.
- **Client**: `aws-sdk-go-v2/service/s3` (vendor-neutral) behind an `ObjectStore`
  interface; switching server = changing `S3_ENDPOINT` + keys.

### ADR-9 — Other adapters
| Concern | Go choice | Replaces |
| --- | --- | --- |
| Claude (primary) | `anthropics/anthropic-sdk-go` | `@anthropic-ai/sdk` |
| Gemini (fallback + moderation) | `google.golang.org/genai` | `@google/genai` |
| JSON extraction / schema hint | ported `extract-json`, `schema-hint` (+ golden tests) | `lib/ai/*` |
| Image re-encode | stdlib `image/jpeg` + `golang.org/x/image` (webp decode, `draw` resize); re-encoding drops EXIF/GPS | `sharp` |
| FIT / GPX | `muktihari/fit` / stdlib `encoding/xml` | `@garmin/fitsdk` / `fast-xml-parser` |
| Email | `wneessen/go-mail` over SMTP | Supabase Auth emails |
| USDA foods | `net/http` client | `app/nutrition/api/foods` |
| ICS | small stdlib writer | `calendar.ics/route.ts` |

AI prompts and schemas are copied verbatim first; improvements come after cutover. Models
stay configurable (`CLAUDE_MODEL`, default `claude-sonnet-5`; `GEMINI_MODEL`, default
`gemini-2.5-flash`). Claude calls are streamed (the Go SDK requires it for 24k-token
plan outputs) and each provider call is time-boxed at 80 s; the server write timeout is
180 s so the fallback still fits.

### ADR-10 — Local development on macOS
- **Runtime**: Docker Desktop or OrbStack (lighter on Apple Silicon); all images are
  multi-arch (arm64 + amd64).
- **`make up`** = `docker compose -f compose.yaml -f compose.dev.yaml up --build --watch`:
  the API image rebuilds on `.go` changes (a few seconds with the build cache), web runs
  `next dev` with source synced into the container. `make infra` starts only Postgres +
  Garage + Mailpit if you prefer to run `pnpm dev` / `go run` natively.
- **First run**: one-shot services from the API image — `storage-init` (Garage layout,
  bucket, access key via the admin API; idempotent) and `migrate` — finish before the API
  starts. `make seed` (Phase 1) loads a trainee, a coach, and an active relationship.
- **Ports**: app `http://localhost:8080`, Mailpit UI `http://localhost:8025`, Postgres
  `localhost:5432` (dev override only, for a DB GUI).
- Secrets live in `.env` (git-ignored); `.env.example` documents every variable.

### ADR-11 — Production on a single VPS
- Same `compose.yaml` without the dev override. Images built by GitHub Actions and pushed
  to GitHub Container Registry; the VPS pulls tagged images (`make deploy` = pull + migrate
  + `up -d`).
- Caddy terminates HTTPS with automatic Let's Encrypt certificates for your domain.
- Firewall: only 22 (SSH, key-only), 80, 443 open.
- Backups: nightly `pg_dump` + bucket sync to off-site storage, 14-day retention;
  restore runbook tested before launch.
- Suggested size: 2 vCPU / 4 GB RAM / 80 GB disk (e.g. Hetzner CX-class) — enough for
  Postgres + Garage + API + Next.js at launch scale.

## 4. Request walk-through — "complete a plan item"

1. User taps the item → `useMutation(PUT /plan-items/{id}/completion)`; optimistic tick.
2. Browser → Caddy → API. Middleware: session cookie → `user_id`, request ID, rate limit.
3. `training.CompletePlanItem` opens `store.WithUser`; loads item + plan (RLS guarantees
   ownership, Go asserts it too); `domain.PlanItemXP(itemType)` → 60/30/20; inserts `logs`
   + `xp_transactions ('plan_item:<id>') ON CONFLICT DO NOTHING`; bumps `profiles.xp`
   (trigger syncs `league_tier`); commits.
4. Response `{ status, xpAwarded, totalXp, level }` → client invalidates `today`, `me`.

## 5. Version matrix (latest stable on 2026-09-24)

### Infrastructure (Docker images)
| Image | Version | Note |
| --- | --- | --- |
| `postgres` | 18.6 | 19 is in beta |
| `dxflrs/garage` | v2.4.1 | object storage |
| `caddy` | 2.11.4 | reverse proxy + automatic HTTPS |
| `axllent/mailpit` | v1.31.2 | local email catcher |
| `golang` (build) | 1.27.1-alpine | runtime: `gcr.io/distroless/static` |
| `node` | 24 LTS (24.21) alpine | 26.x is current but not LTS |

### Web (`apps/web`)
| Package | Version | Note |
| --- | --- | --- |
| pnpm | 12.6.0 | |
| next / eslint-config-next | 16.3.6 | |
| react / react-dom / @types/react | 19.3.0 | |
| typescript | **6.0.3** | 7.0.2 is latest; typescript-eslint 8.70.1 peers `<6.1.0` |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | tw-animate-css 1.4.0 |
| @tanstack/react-query (+ devtools, eslint-plugin-query) | 5.103.2 | |
| nuqs | 2.10.1 | |
| openapi-typescript / openapi-fetch / openapi-react-query | 7.13.0 / 0.17.0 / 0.5.4 | |
| zod | 4.6.5 | |
| react-hook-form / @hookform/resolvers | 7.88.0 / 5.9.1 | |
| lucide-react | 1.47.0 | 1.48.0 is < 1 day old (see note below) |
| sonner / next-themes | 2.0.8 / 0.4.6 | |
| storybook / @storybook/nextjs-vite / eslint-plugin-storybook | 10.6.0 | |
| vitest | 5.0.1 | |
| @playwright/test | 1.63.0 | |
| eslint / typescript-eslint | 10.11.0 / 8.70.1 | |
| msw | 2.15.0 | API mocks for Storybook + component tests |

### API (`apps/api`)
| Module | Version |
| --- | --- |
| Go toolchain | 1.27.1 |
| github.com/go-chi/chi/v5 | v5.3.2 |
| github.com/danielgtaylor/huma/v2 | v2.39.1 |
| github.com/jackc/pgx/v5 | v5.11.0 |
| sqlc | v1.31.1 |
| github.com/pressly/goose/v3 | v3.28.0 |
| github.com/anthropics/anthropic-sdk-go | v1.75.0 |
| google.golang.org/genai | v1.71.0 |
| github.com/muktihari/fit | v0.28.4 |
| github.com/aws/aws-sdk-go-v2 / service/s3 | v1.47.0 / v1.113.3 |
| github.com/wneessen/go-mail | v0.8.1 |
| golang.org/x/crypto (argon2id, bcrypt) | v0.57.0 |
| golang.org/x/image | v0.46.0 |
| github.com/testcontainers/testcontainers-go | v0.44.0 |
| golangci-lint | v2.14.0 |

Re-check with `pnpm outdated` / `go list -m -u all` / image tags at the start of each
phase; bump in a dedicated commit.

**"Latest" means latest release that is at least one day old.** pnpm 12 enforces
`minimumReleaseAge` (1 day) when installing in CI, a guard against compromised fresh
releases. A version published today fails `pnpm install --frozen-lockfile` in CI; pick the
previous release and regenerate the lockfile (`pnpm clean --lockfile && pnpm install`).
