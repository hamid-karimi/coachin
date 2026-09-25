# CoachIn

Training + gamification app: plan your week, log workouts and meals, earn XP, streaks, and
league tiers; coaches follow their trainees.

This branch (`feat/backend-rewrite-with-go`) is a **Go API + frontend-only Next.js**
monorepo, fully self-hosted with Docker (Postgres, Garage object storage, Caddy). The
previous production app (Next.js + Supabase on Vercel) lives on `main` / `develop` until
go-live.

- Plan, spec, architecture: [`plans/go-backend-rewrite/`](plans/go-backend-rewrite/)
- Formulas (XP, streaks, tiers…): [`FORMULAS.md`](FORMULAS.md)
- How to test it: [`QA-ONBOARDING.md`](QA-ONBOARDING.md)
- Where the work stands: [`WORKLOG.md`](WORKLOG.md)

## Stack

| Service | What | Local URL |
| --- | --- | --- |
| `caddy` | Single entry point: `/api/*` → API, everything else → web. Automatic HTTPS on the VPS | http://localhost:8080 |
| `web` | Next.js 16 (App Router), TanStack Query, nuqs, Tailwind 4 | via Caddy |
| `api` | Go 1.27 (chi + huma, OpenAPI 3.1), pgx, goose | http://localhost:8080/api/v1/docs |
| `postgres` | PostgreSQL 18 | `localhost:5432` (dev only) |
| `garage` | S3-compatible object storage (private; the API serves files) | internal |
| `mailpit` | Catches every email the app sends (dev only) | http://localhost:8025 |

## Run it on your Mac

Prerequisite: [OrbStack](https://orbstack.dev) (lighter on Apple Silicon) or Docker Desktop.

```bash
make up        # first run copies .env.example → .env, builds, starts, hot-reloads
```

Open http://localhost:8080 to sign in; http://localhost:8080/status shows the API, database, and storage as
healthy. Edit files under `apps/web` or `apps/api` and the stack reloads on its own.

AI features (training plans, meal plans, photo estimates, photo moderation) need
`CLAUDE_API_KEY` and/or `GEMINI_API_KEY` in `.env` — Claude first, Gemini as the fallback.
Without them those features answer "temporarily unavailable"; everything else works.

`make seed` adds demo accounts: `trainee@coachin.local` and `coach@coachin.local`, both
with password `Coachin-demo1`. Emails the app sends (sign-up confirmation, password
reset) show up in Mailpit at http://localhost:8025.

`make e2e` runs the Playwright QA journeys (`apps/web/e2e`) against the stack with a fake
Claude and Community on (`compose.e2e.yaml`); CI runs the same suite.

`make help` lists everything else (`down`, `logs`, `migrate`, `reset-db`, `gen`, `test`,
`lint`, `dev-web`, `infra`, `import-supabase`).

> After pulling a change that adds a database role, run `make reset-db` once: roles are
> created only when the Postgres volume is first initialized.

## Monorepo

One repository, two apps, one set of commands at the root:

- **JS**: a pnpm workspace (`pnpm-workspace.yaml`, one `pnpm-lock.yaml` at the root);
  `apps/web` is package `coachin-web`. `make install` (or `pnpm install`) at the root.
- **Go**: `go.work` at the root uses `apps/api`, so editors and `go` work from the root too.
- **Commands**: the Makefile is the entry point; the root `package.json` mirrors the common
  ones (`pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm gen`, `pnpm e2e`, `pnpm dev:web`).
- **Contract**: the Go API emits `openapi/openapi.json`; the web's typed client
  (`apps/web/lib/api/schema.d.ts`) is generated from it (`make gen`). CI fails if either is stale.

Frontend work without Docker rebuilds: keep `make up` running, then `make dev-web` (or
`pnpm dev:web`) serves Next.js natively on http://localhost:3000 — it proxies `/api` to the
stack at :8080 (`apps/web/.env.development`).

For `make install`, `make dev-web`, `make gen`, `make test`, and `make lint` you need on the
machine itself: Go 1.27, Node 24 with `corepack enable` (pnpm 12), [sqlc](https://sqlc.dev)
1.31, and [golangci-lint](https://golangci-lint.run) v2. `make up` needs only Docker.

## Repository layout

```
apps/api/        Go API — cmd/api (serve, migrate, storage-init, seed, openapi, healthcheck,
                 import-supabase)
apps/web/        Next.js frontend — typed client generated from openapi/openapi.json
openapi/         The API contract, generated from Go (`make gen`); CI checks it is current
deploy/          Caddyfile, Garage config, Postgres init script, runbooks (deploy/README.md)
compose.yaml     The whole stack (also what runs on the VPS)
compose.dev.yaml Local-only additions: hot reload, Mailpit, Postgres port
package.json     Workspace root (pnpm) — mirrors the Makefile's common commands
go.work          Go workspace (apps/api)
testdata/        Golden vectors pinning every formula (see FORMULAS.md)
plans/           Rewrite spec, architecture, and phased plan
```

## Branches

All rewrite work merges into `feat/backend-rewrite-with-go` through pull requests.
`main` and `develop` keep the current app and never receive rewrite changes.
