# CoachIn

Training + gamification app: plan your week, log workouts and meals, earn XP, streaks, and
league tiers; coaches follow their trainees.

This branch (`feat/backend-rewrite-with-go`) rebuilds it as a **Go API + frontend-only
Next.js**, fully self-hosted with Docker. The current production app (Next.js + Supabase on
Vercel) lives on `main` / `develop`, with a read-only copy in [`legacy/`](legacy/) as the
reference for the port.

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

AI features (training plans; later meal plans and photo estimates) need
`CLAUDE_API_KEY` and/or `GEMINI_API_KEY` in `.env` — Claude first, Gemini as the fallback.
Without them those features answer "temporarily unavailable"; everything else works.

`make seed` adds demo accounts: `trainee@coachin.local` and `coach@coachin.local`, both
with password `Coachin-demo1`. Emails the app sends (sign-up confirmation, password
reset) show up in Mailpit at http://localhost:8025.

`make e2e` runs the Playwright QA journeys (`apps/web/e2e`) against the stack with a fake
Claude and Community on (`compose.e2e.yaml`); CI runs the same suite.

`make help` lists everything else (`down`, `logs`, `migrate`, `reset-db`, `gen`, `test`,
`lint`, `infra`, `golden`).

> After pulling a change that adds a database role (like this one), run `make reset-db`
> once: roles are created only when the Postgres volume is first initialized.

For `make gen`, `make test`, and `make lint` you also need these on the Mac itself:
Go 1.27, Node 24 with `corepack enable` (pnpm 12), [sqlc](https://sqlc.dev) 1.31, and
[golangci-lint](https://golangci-lint.run) v2.

## Repository layout

```
apps/api/        Go API — cmd/api (serve, migrate, storage-init, openapi, healthcheck)
apps/web/        Next.js frontend — typed client generated from openapi/openapi.json
openapi/         The API contract, generated from Go (`make gen`); CI checks it is current
deploy/          Caddyfile, Garage config, Postgres init script
compose.yaml     The whole stack (also what runs on the VPS)
compose.dev.yaml Local-only additions: hot reload, Mailpit, Postgres port
legacy/          Old Next.js + Supabase app — reference only, deleted at cutover
plans/           Rewrite spec, architecture, and phased plan
```

## Branches

All rewrite work merges into `feat/backend-rewrite-with-go` through pull requests.
`main` and `develop` keep the current app and never receive rewrite changes.
