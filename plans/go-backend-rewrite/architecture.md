# Architecture — Go API + frontend-only Next.js

Status: **Proposed** · Date: 2026-09-24 · Spec: [`spec.md`](spec.md) · Plan: [`plan.md`](plan.md)

## 1. Target shape

```
                       browser
                          │  same origin: https://coachin.app
                          ▼
┌──────────────────────── apps/web (Next.js 16.3) ────────────────────────┐
│ Server Components ── prefetch via typed client ──┐                      │
│ Client Components ── TanStack Query / nuqs ──────┤  /api/* rewrite ─────┼──┐
│ proxy.ts: cookie-presence redirect only          │                      │  │
└──────────────────────────────────────────────────┼──────────────────────┘  │
                         API_INTERNAL_URL (server) │                          │
                                                   ▼                          ▼
┌──────────────────────── apps/api (Go 1.27) ─────────────────────────────────┐
│ transport/http   chi router + huma (OpenAPI 3.1), session cookie, rate limit│
│ app/<module>     use cases: training, nutrition, coaching, profile, …       │
│ domain           pure formulas: xp, streak, tiers, running, scorecard, …    │
│ store            sqlc queries on pgx, tx helper that sets RLS user context  │
│ adapters         ai (Claude→Gemini), media (image, S3), importer (FIT/GPX), │
│                  auth (credential store), usda                              │
└──────────────┬───────────────────────────┬───────────────────┬──────────────┘
               ▼                           ▼                   ▼
        Postgres (RLS kept)        S3-compatible storage   Claude / Gemini / USDA
```

Dependencies point inward exactly as the repo's clean-architecture rule already demands
(`coding-style` §10): `transport → app → domain`, with `store` and `adapters` implementing
interfaces declared by `app`. `domain` imports nothing but the standard library.

## 2. Repository layout (monorepo)

```
apps/
  web/                 Next.js app (git mv of today's app/, components/, lib/ UI-side, public/)
  api/
    cmd/api/           main: config, wiring, graceful shutdown
    internal/
      domain/          xp, streak, tiers, running, goals, scorecard, nutrition, dates,
                       quotas, supplements, plan items, share rules … (+ *_test.go)
      app/             one package per module: auth, onboarding, today, training,
                       nutrition, profile, coaching, community
      store/           sqlc output + tx.go (RLS context) + queries/*.sql
      transport/http/  handlers per module, middleware, problem+json, openapi export
      adapters/        ai/, media/, importer/, credentials/, usda/, objectstore/
    sqlc.yaml
db/
  migrations/          goose SQL migrations (00001_baseline.sql = today's schema)
testdata/
  golden/              JSON vectors shared by vitest (during transition) and go test
openapi/
  openapi.json         emitted by `go run ./cmd/api openapi`, committed, CI drift check
FORMULAS.md, QA-ONBOARDING.md, WORKLOG.md, CLAUDE.md   (stay at root)
```

`pnpm-workspace.yaml` covers `apps/web`; Go is its own module (`apps/api/go.mod`). A root
`Makefile`/`justfile` gives one command per task (`dev`, `gen`, `test`, `lint`).

## 3. Architecture decisions (ADRs)

### ADR-1 — Go HTTP stack: chi + huma, not a framework
- **Decision**: `go-chi/chi/v5` for routing/middleware, `danielgtaylor/huma/v2` on top for
  typed handlers that **generate OpenAPI 3.1** from Go structs, with request validation.
- **Why**: code-first contract with zero hand-written YAML; stdlib-compatible `net/http`
  (no Gin/Echo/Fiber lock-in); multipart and streaming (ICS) supported.
- **Rejected**: gRPC/Connect (browser + SSR friction for little gain at this size);
  oapi-codegen spec-first (two sources of truth while the domain is being ported).

### ADR-2 — Data access: pgx + sqlc + goose; Postgres unchanged
- **Decision**: `jackc/pgx/v5` pool, `sqlc` generates typed Go from SQL files, `goose`
  runs migrations. The 40 Supabase migrations are squashed into `00001_baseline.sql` from a
  `pg_dump --schema-only` of production; history is kept in git.
- **Why**: SQL stays SQL (the team already writes complex SQL); compile-time-checked
  queries; no ORM.
- **Supabase-specific objects** (`auth.uid()`, `authenticated` role, `storage.*`) keep
  working while the DB is hosted on Supabase; `00002_auth_compat.sql` recreates `auth.uid()`
  and the role for any plain Postgres (local dev, CI, future host).

### ADR-3 — Auth: Go-owned sessions, pluggable credential store
- **Decision**: the API issues an opaque 256-bit session token in an
  `__Host-coachin_session` cookie (`HttpOnly; Secure; SameSite=Lax`, 30-day sliding
  expiry); only its SHA-256 is stored (`sessions` table). Password verification sits behind
  `app/auth.CredentialStore`:
  - **v1 `supabaseCredentials`** — signup and password check via GoTrue's HTTP API
    (keeps email confirmation behavior, zero user migration).
  - **v2 `nativeCredentials`** (Phase 6) — reads `auth.users.encrypted_password` (bcrypt),
    verifies it, rehashes to argon2id into our own `credentials` table on login. Same
    UUIDs, so every FK stays valid; no password reset for anyone.
- **Why**: the frontend never sees a token or a Supabase SDK; swapping the provider
  later is invisible to it. Opaque server-side sessions give instant logout/revocation
  (which JWTs don't).
- **CSRF**: `SameSite=Lax` + same-origin (ADR-6) + required `Content-Type: application/json`
  or multipart with an `X-Requested-With` header on mutations.

### ADR-4 — Authorization: explicit in Go, RLS kept as a safety net
- **Decision**: every request's DB work runs in a transaction opened by `store.WithUser`:
  ```sql
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{"sub":"<user-id>","role":"authenticated"}', true);
  ```
  so the existing **92 RLS policies** and `auth.uid()` keep enforcing unchanged. Use cases
  also check permissions explicitly (e.g. `coaching.RequireActiveRelationship`), which is
  what the tests assert.
- **Why**: RLS already encodes the access rules correctly; keeping it means a missed Go
  check fails closed instead of leaking data. It turns the riskiest part of the rewrite into
  additive work.
- Background/system work (none today) would use a separate `store.WithSystem` tx.

### ADR-5 — Business logic: one Go implementation, SQL functions retired
- **Decision**: port in two steps. **Step A** — Go handlers call the existing RPCs
  (`complete_plan_item`, `award_meal_xp`, …) inside `WithUser`, so parity is immediate.
  **Step B** — move each RPC's logic into `domain` + an `app` use case running in one
  transaction, then drop the SQL function in a migration.
- **Idempotency**: a unique index `xp_transactions (user_id, reason)` makes every award
  idempotent at the database level; use cases use `INSERT … ON CONFLICT DO NOTHING` and
  check rows affected. (Plan-item undo keeps its compensating `plan_item_undo:<id>` txn.)
- **Row locking**: streak settle and group-day evaluation `SELECT … FOR UPDATE` the profile /
  group row, so concurrent requests serialize (today's RPCs rely on SECURITY DEFINER +
  single statement).
- **Parity**: `testdata/golden/*.json` vectors are generated from today's `lib/*.test.ts`
  inputs/outputs; `go test ./internal/domain/...` runs the same vectors. FORMULAS.md
  "source of truth" pointers move to `apps/api/internal/domain/*.go`.

### ADR-6 — Frontend ↔ API: same origin through Next rewrites
- **Decision**: `next.config.ts` rewrites `/api/:path*` → `${API_INTERNAL_URL}/v1/:path*`.
  Browser calls are same-origin (no CORS, host-only cookie). Server Components call
  `API_INTERNAL_URL` directly and forward the incoming `cookie` header.
- **Why**: simplest secure setup; one domain; works identically in dev.
- **Later option**: point the browser at `api.coachin.app` directly if the rewrite hop ever
  matters — only the client `baseUrl` changes.

### ADR-7 — Frontend data layer: generated client + TanStack Query + nuqs
- **Typed client**: `openapi-typescript` generates `apps/web/lib/api/schema.d.ts` from
  `openapi/openapi.json`; `openapi-fetch` is the fetcher; `openapi-react-query` gives
  `$api.useQuery('get', '/today')` / `$api.useMutation(...)` with fully inferred types.
  No hand-written fetch functions or response types.
- **SSR**: each page (`page.tsx`, still orchestration-only) creates a request-scoped
  `QueryClient`, `prefetchQuery` with the server client, wraps children in
  `<HydrationBoundary state={dehydrate(qc)}>`. Client leaves read the same keys — no
  waterfall, no flash.
- **Mutations**: `useMutation` + `queryClient.invalidateQueries`; optimistic updates for
  plan-item and supplement toggles. `useActionToast` becomes `useMutationToast` over the
  same `{status, message}` result shape.
- **URL state**: `nuqs` (`NuqsAdapter` for App Router). Parsers live in
  `apps/web/lib/search-params.ts`; pages read them with `createSearchParamsCache` so
  server and client agree.
- **Forms**: `react-hook-form` + `zod` 4 schemas for client-side UX validation; the API
  remains the authority and returns field errors in problem+json `errors[]`.
- **Unchanged**: design system, Tailwind tokens, Storybook, share-card canvas, PWA.

### ADR-8 — Adapters
| Concern | Go choice | Replaces |
| --- | --- | --- |
| Claude (primary) | `anthropics/anthropic-sdk-go` | `@anthropic-ai/sdk` |
| Gemini (fallback + moderation) | `google.golang.org/genai` | `@google/genai` |
| JSON extraction / schema hint | ported `extract-json`, `schema-hint` (+ golden tests) | `lib/ai/*` |
| Image re-encode | stdlib `image/jpeg` + `golang.org/x/image` (webp decode, `draw` resize); re-encoding drops EXIF/GPS | `sharp` |
| FIT | `muktihari/fit` | `@garmin/fitsdk` |
| GPX | stdlib `encoding/xml` + haversine in `domain` | `fast-xml-parser` |
| Object storage | `minio/minio-go/v7` against an S3-compatible endpoint (Supabase Storage S3 API now; R2/S3 later) | Supabase storage client |
| USDA foods | `net/http` client with cache headers | `app/nutrition/api/foods` |
| ICS | small stdlib writer (port of `escapeIcs`) | `calendar.ics/route.ts` |

AI prompts and schemas are copied verbatim first (parity), improvements come after cutover.
The default Claude model stays configurable via `CLAUDE_MODEL`.

### ADR-9 — Config, observability, delivery
- Config from env only (`envconfig`-style struct, fail fast on missing required vars).
  Pinned `TZ=UTC` (spec R5).
- `log/slog` JSON; request-ID + user-ID middleware; `/healthz` (liveness), `/readyz`
  (DB ping). OpenTelemetry hooks added only when a collector exists.
- Rate limits (in-process token bucket) on `/auth/*`, AI endpoints, uploads.
- Docker: multi-stage → `gcr.io/distroless/static` for the API; `node:24-alpine` standalone
  for web. CI: `golangci-lint`, `go test` (with testcontainers Postgres), `sqlc diff`,
  OpenAPI drift check, `tsc`, `eslint`, `vitest`, Playwright journeys.

## 4. Request walk-through — "complete a plan item"

1. User taps the item → `useMutation(PUT /plan-items/{id}/completion)`; optimistic tick.
2. Browser → `coachin.app/api/plan-items/…` → rewrite → Go.
3. Middleware: session cookie → `user_id`; rate limit; request ID.
4. `training.CompletePlanItem` opens `store.WithUser(ctx, uid)`; loads item + plan (RLS
   guarantees ownership; Go asserts it too); `domain.PlanItemXP(itemType)` → 60/30/20;
   inserts `logs` row + `xp_transactions (reason 'plan_item:<id>') ON CONFLICT DO NOTHING`;
   bumps `profiles.xp` (trigger keeps `league_tier` in sync); commits.
5. Response `{ status, xpAwarded, totalXp, level }` → client invalidates `today`, `me`.

## 5. What gets deleted from the web app at the end

`lib/supabase/*`, every `actions.ts` that writes data, the 3 route handlers, `lib/ai/*`,
`lib/activity-*`, server-side image code, and the TS copies of formulas that only the
server needed. Formulas the UI needs for instant display (e.g. `levelFromXp` for the XP
bar) are served by the API instead of recomputed client-side.

## 6. Version matrix (latest stable on 2026-09-24)

### Web (`apps/web`)
| Package | Version | Note |
| --- | --- | --- |
| Node.js | 24.21 LTS | 26.x is current but not LTS |
| pnpm | 12.6.0 | |
| next / eslint-config-next | 16.3.6 | |
| react / react-dom / @types/react | 19.3.0 | |
| typescript | **6.0.3** | 7.0.2 is latest, but typescript-eslint 8.70.1 peers `<6.1.0` (spec R6) |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | tw-animate-css 1.4.0 |
| @tanstack/react-query (+ devtools, eslint-plugin-query) | 5.103.2 | |
| nuqs | 2.10.1 | |
| openapi-typescript / openapi-fetch / openapi-react-query | 7.13.0 / 0.17.0 / 0.5.4 | |
| zod | 4.6.5 | |
| react-hook-form / @hookform/resolvers | 7.88.0 / 5.9.1 | |
| lucide-react | 1.48.0 | |
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
| github.com/minio/minio-go/v7 | v7.3.0 |
| golang.org/x/crypto (argon2id, bcrypt) | v0.57.0 |
| golang.org/x/image | v0.46.0 |
| github.com/testcontainers/testcontainers-go | v0.44.0 |
| golangci-lint | v2.14.0 |

Re-check with `pnpm outdated` / `go list -m -u all` at the start of each phase; bump in a
dedicated commit.
