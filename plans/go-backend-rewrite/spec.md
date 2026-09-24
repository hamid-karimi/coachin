# Spec — Go backend + frontend-only Next.js, fully self-hosted

Status: **Draft for approval** · Owner: Hamid · Date: 2026-09-24
Companions: [`architecture.md`](architecture.md) (how) · [`plan.md`](plan.md) (when)

## 1. Problem

Today every backend concern lives inside the Next.js app or inside Supabase:

| Concern | Where it lives now | Size |
| --- | --- | --- |
| Mutations | 54 server actions across 13 `actions.ts` files | — |
| HTTP endpoints | 3 route handlers (`foods`, `discover`, `calendar.ics`) | — |
| Authorization | **92 RLS policies**, 140 `auth.uid()` references | 40 migrations |
| Multi-step writes (XP, streaks, memberships) | 24 SECURITY DEFINER SQL functions | — |
| Business formulas | `lib/*.ts` **and** mirrored in SQL (`evaluate_user_streak` ↔ `lib/streak.ts`, `league_tier_for_xp` ↔ `lib/tiers.ts`) | ~22k LOC app-wide |
| AI (Claude primary, Gemini fallback) | `lib/ai/*` called from server actions | 8 generators |
| File pipelines | `sharp` re-encode + Gemini moderation; FIT/GPX parsing | — |
| Auth, storage, hosting | Supabase Auth, Supabase Storage (`body_photos` bucket), Vercel | — |

Consequences we want to fix:

1. **Two implementations of the same formula** (TS + SQL), kept in sync by hand.
2. **No API** — logic is only reachable through Next.js server actions.
3. **Authorization is scattered** across RLS, SECURITY DEFINER functions, and action code.
4. **Vendor lock-in** to Supabase (auth, storage, RLS conventions) and Vercel (hosting).

## 2. Goals

- G1 — A **Go HTTP API** owns all data access, authorization, business rules, auth, email,
  AI calls, and file pipelines.
- G2 — **Next.js is frontend only**: rendering, routing, URL state, client cache. No
  database client, no secrets, no server actions that write data.
- G3 — **Zero Supabase, zero Vercel.** No `@supabase/*` package, no `auth.*` / `storage.*`
  schema, no Supabase-specific roles or functions, no Vercel-specific config.
- G4 — **Self-hosted with Docker Compose.** Everything runs locally on macOS with one
  command (`make up`); the same images and compose file later run on a single VPS.
- G5 — **Behavioral parity**: every formula in `FORMULAS.md` and every journey in
  `QA-ONBOARDING.md` behaves identically.
- G6 — **One implementation per formula** (Go `internal/domain`), proven by shared golden
  test vectors.
- G7 — **Typed contract**: OpenAPI 3.1 generated from Go; the frontend client is generated
  from it; drift fails CI.
- G8 — **Latest stable versions** of every package and image at start of work
  (architecture §6).

## 3. Non-goals (v1)

- New features or UX redesign — the UI is ported, not reinvented.
- Native mobile app (the API enables it later).
- Per-user time zones — v1 keeps today's semantic (the server's local day, pinned to UTC).
- Multi-server / high availability — one VPS, one Postgres, one storage node.
- Re-enabling community surfaces — the `community` flag stays **off**; endpoints are ported
  but gated.

## 4. Users & roles (unchanged)

`student` (UI: "trainee"), `coach`, `both`, `admin` — from `profiles.role`. Coach features
require an **active** `coaching_relationships` row. Role-aware landing: coach → `/coaching`,
everyone else → `/dashboard`.

## 5. Functional requirements — API surface

Every server action and route handler maps to one endpoint under `/api/v1`. Mutations
return the updated resource or a result object mirroring today's action state
(`status: success | info | error`, `message`) so toasts keep working.

### 5.1 Auth & session (new: owned by Go, replaces Supabase Auth)
| Today | Endpoint |
| --- | --- |
| `registerAction` | `POST /auth/register` → creates user, sends verification email, signs in |
| `loginAction` | `POST /auth/login` → sets session cookie |
| `logoutAction` | `POST /auth/logout` → revokes session |
| (Supabase email link) | `POST /auth/verify-email` (token from email) |
| (Supabase reset flow) | `POST /auth/password/forgot`, `POST /auth/password/reset` |
| — | `POST /auth/password/change` (signed in) |
| `getUser()` in pages | `GET /me` (profile + role + feature flags) |

- Password rules unchanged: ≥ 8 chars, upper + lower + digit, valid email.
- Email verification is sent but **does not block login** in v1 (same experience as today's
  default); a banner nudges unverified users.
- Reset/verify tokens: single-use, hashed at rest, expire (reset 1 h, verify 7 d).
- Login, register, and forgot-password are rate-limited per IP and per email.

### 5.2 Onboarding / My week
| Today | Endpoint |
| --- | --- |
| `getSportTypes` | `GET /sport-types` |
| `getUserSchedules`, `addScheduleSessions`, `deleteScheduleItem` | `GET/POST /schedules`, `DELETE /schedules/{id}` |
| `getWeeklyQuotas`, `addWeeklyQuota`, `deleteWeeklyQuota` | `GET/POST /weekly-quotas`, `DELETE /weekly-quotas/{id}` |
| `getCurrentPlanWeekItems` | `GET /plan-items?scope=current-week` |
| `completeOnboarding` | `POST /onboarding/complete` |

### 5.3 Today (dashboard), streaks, supplements
| Today | Endpoint |
| --- | --- |
| dashboard page loader (incl. lazy streak settle) | `GET /today` + `POST /me/streak/settle` (idempotent) |
| `logWorkout` | `POST /workout-logs` |
| `addSupplementAction`, `updateSupplementScheduleAction`, `deleteSupplementAction` | `POST /supplements`, `PATCH /supplements/{id}`, `DELETE /supplements/{id}` |
| `toggleSupplementLogAction` | `PUT` / `DELETE /supplements/{id}/logs/{date}` |

### 5.4 Training
| Today | Endpoint |
| --- | --- |
| `generatePlanAction` / `generateHypertrophyPlanAction` | `POST /training-plans` (`kind: race \| hypertrophy`, optional `studentId` for coach mode) |
| `archivePlanAction` | `POST /training-plans/{id}/archive` |
| `togglePlanItemAction` | `PUT` / `DELETE /plan-items/{id}/completion` |
| `logSessionAction` | `POST /session-logs` |
| check-in page + `applyCheckinAction` | `GET /training-plans/{id}/checkin`, `POST /training-plans/{id}/checkins` |
| `parseActivitiesAction` | `POST /activities/parse` (multipart FIT/GPX) |
| `calendar.ics` route | `GET /training-plans/calendar.ics` |
| `/calendar` page loader | `GET /calendar?week=YYYY-MM-DD` |

### 5.5 Nutrition
| Today | Endpoint |
| --- | --- |
| `api/foods` route (USDA proxy) | `GET /foods?q=` |
| `logMealAction`, `deleteMealLogAction` | `POST /meal-logs`, `DELETE /meal-logs/{id}` |
| `estimateMealPhotoAction` → `confirmPhotoMealsAction` | `POST /meal-logs/photo-estimate` (multipart) → `POST /meal-logs/batch` |
| page loader (day totals, targets, trends) | `GET /nutrition/day?date=`, `GET /nutrition/trends` |
| `generateMealPlanAction`, `discardMealPlanAction` | `POST /meal-plans`, `DELETE /meal-plans/{id}` |

### 5.6 Profile, goals, body
| Today | Endpoint |
| --- | --- |
| `updateProfileAction`, `setNutritionSharingAction` | `PATCH /me/profile` |
| `addMeasurementAction`, `deleteMeasurementAction` | `POST /measurements`, `DELETE /measurements/{id}` |
| `importActivitiesAction` | `POST /activities/import` |
| `uploadBodyPhotosAction`, `uploadProgressPhotoAction` | `POST /photos` (multipart, `kind: body \| progress`) |
| `deleteBodyPhotoAction` | `DELETE /photos/{id}` |
| signed image URLs (today via Supabase Storage) | `GET /photos/{id}` — API checks access and streams the image (storage is never public) |
| `analyzePhotosAction`, `extractReportAction` | `POST /photos/analyze`, `POST /reports/extract` |
| `createGoalAction`, `abandonGoalAction`, `achieve_goal` RPC | `POST /goals`, `POST /goals/{id}/abandon`, `POST /goals/{id}/achieve` |
| profile page loaders (stats, XP history, charts) | `GET /me/overview`, `GET /me/progress` |

### 5.7 Coaching
| Today | Endpoint |
| --- | --- |
| `generateCoachInviteCodeAction` | `POST /coach/invite-codes` |
| `connectCoachByCodeAction` | `POST /coaching/join` → `created \| already_connected \| reactivated` |
| coaching hub loader | `GET /coach/trainees` (roster + adherence) |
| trainee nutrition / supplements (consent-gated) | `GET /coach/trainees/{id}/nutrition`, `…/supplements` |
| `assignCoachWeeklyPlanAction` | `POST /coach/trainees/{id}/weekly-plan` |

### 5.8 Community (flag-gated, `404` while off — same as today)
Clubs (create, join by code, leave, set primary), follows, training groups (create, join,
leave, trained-today, group-day evaluation), weekly leaderboard, discover. Paths under
`/community/*`.

### 5.9 Cross-cutting behavior
- **Idempotency**: every XP award stays idempotent by its FORMULAS.md reason key, enforced
  by a unique constraint.
- **Uploads**: 8 MB request cap; photo caps (body 5, progress 24) stay DB-enforced.
- **AI**: Claude primary, Gemini fallback, "AI is temporarily unavailable" when neither is
  configured — same contract as `lib/ai/README.md`.
- **Errors**: RFC 9457 problem+json; user-facing text stays English-only.

## 6. Frontend requirements

- Every route in QA-ONBOARDING's module map renders server-side with data prefetched from
  the API, then hydrates into TanStack Query (no loading flash on first paint).
- URL state via **nuqs**: profile `?tab=`, training `?student=`, calendar `?week=`,
  nutrition `?date=`, community tabs.
- Mutations via TanStack Query `useMutation`; plan-item and supplement toggles are
  optimistic with rollback.
- New auth screens: forgot password, reset password, verify email, change password.
- Kept: design system + tokens, sonner toasts, next-themes, PWA, Storybook, share-card
  canvas.
- No auth token in JS: session lives in an `HttpOnly` cookie.

## 7. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Local dev | `make up` on macOS (Apple Silicon) starts the full stack; `make down`, `make reset-db`, `make seed`; hot reload for API and web |
| Performance | p95 API latency < 150 ms for non-AI reads; fits a 2 vCPU / 4 GB VPS |
| Security | Authorization in Go **and** Postgres RLS; argon2id passwords; secrets only in the API's env; rate limits on auth, AI, uploads; only Caddy's ports exposed |
| Reliability | Multi-write operations in one DB transaction; AI calls time-boxed (60 s) with fallback |
| Data safety (VPS) | Nightly `pg_dump` + storage sync to off-site storage, restore tested |
| Observability | `slog` JSON logs with request ID + user ID; `/healthz`, `/readyz` |
| Testability | Domain logic covered by golden vectors; integration tests on real Postgres (testcontainers) |

## 8. Acceptance criteria

1. Every `lib/` logic test (216+ vitest cases) has a Go equivalent passing on the **same**
   golden vectors.
2. Every QA-ONBOARDING journey (1–8) passes end-to-end (Playwright) against the Docker stack.
3. `make up` on a clean Mac brings up the stack; a seeded trainee and coach can do every
   journey.
4. Repo contains no `@supabase/*` dependency, no `supabase/` directory, no reference to
   `auth.uid()`, `auth.users`, or `storage.*`, and no `vercel` config.
5. Web app has no `sharp`, AI SDK, `@garmin/fitsdk`, or `fast-xml-parser` dependency and
   no `"use server"` data writes.
6. FORMULAS.md "source of truth" pointers reference Go files only.
7. `openapi.json` in the repo equals what the API emits (CI check).
8. (Go-live) Imported Supabase users log in with their existing passwords; XP, streaks,
   plans, and photos are intact.

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Formula drift during port | Golden vectors exported from current TS tests; both suites run on them until the TS copy is deleted |
| R2 | Authorization regressions (92 RLS policies) | Policies rewritten mechanically to `app.current_user_id()` and kept as a safety net under Go's explicit checks (ADR-4) |
| R3 | Losing existing users/passwords when leaving Supabase | One-time importer keeps user UUIDs and bcrypt hashes; Go verifies bcrypt then rehashes to argon2id on first login (ADR-3) |
| R4 | Building auth ourselves (reset, verification, sessions) | Small, well-known surface; opaque server sessions; hashed single-use tokens; rate limits; security review before go-live |
| R5 | "Today" semantics — `lib/dates.ts` uses the server's local day | API container pinned to `TZ=UTC` (matches Vercel today) |
| R6 | TypeScript 7 is latest but typescript-eslint 8.70 supports `<6.1` | Pin TS **6.0.3**; revisit when typescript-eslint supports TS 7 |
| R7 | Image pipeline without `sharp` | Pure-Go decode/resize/re-encode (drops EXIF); HEIC stays client-converted as today |
| R8 | Object-storage choice after MinIO went maintenance-only | S3 API only, behind an interface — switch between Garage, RustFS, SeaweedFS, or a managed S3 bucket by config (ADR-8) |
| R9 | Single VPS is a single point of failure | Accepted for v1; nightly off-site backups + a documented restore runbook |

## 10. Open questions (defaults assumed in the plan)

1. **Existing production data** — default: import Supabase users, data, and photos once at
   go-live (Phase 7). If there's nothing worth keeping, skip the importer.
2. **Transactional email on the VPS** — default: any SMTP provider (e.g. Postmark, Resend,
   Amazon SES); locally Mailpit catches everything.
3. **Domain name** — needed at go-live for Caddy's automatic HTTPS.
