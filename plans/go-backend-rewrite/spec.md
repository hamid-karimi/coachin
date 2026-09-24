# Spec — Go backend + frontend-only Next.js

Status: **Draft for approval** · Owner: Hamid · Date: 2026-09-24
Companions: [`architecture.md`](architecture.md) (how) · [`plan.md`](plan.md) (when)

## 1. Problem

Today every backend concern lives inside the Next.js app or inside Postgres:

| Concern | Where it lives now | Size |
| --- | --- | --- |
| Mutations | 54 server actions across 13 `actions.ts` files | — |
| HTTP endpoints | 3 route handlers (`foods`, `discover`, `calendar.ics`) | — |
| Authorization | **92 RLS policies**, 140 `auth.uid()` references | 40 migrations |
| Multi-step writes (XP, streaks, memberships) | 24 SECURITY DEFINER SQL functions | — |
| Business formulas | `lib/*.ts` **and** mirrored in SQL (`evaluate_user_streak` ↔ `lib/streak.ts`, `league_tier_for_xp` ↔ `lib/tiers.ts`) | ~22k LOC app-wide |
| AI (Claude primary, Gemini fallback) | `lib/ai/*` called from server actions | 8 generators |
| File pipelines | `sharp` re-encode + Gemini moderation; FIT/GPX parsing | — |
| Auth + storage | Supabase Auth, Supabase Storage (`body_photos` bucket) | — |

Consequences we want to fix:

1. **Two implementations of the same formula** (TS + SQL) that must be kept in sync by hand
   (FORMULAS.md exists partly to police this).
2. **No API.** Logic is only reachable through Next.js server actions — no mobile client,
   no integrations, no independent scaling or deploys of the backend.
3. **Authorization is scattered** across RLS, SECURITY DEFINER functions, and action code
   (e.g. the community flag had to be re-checked inside actions because "actions are
   public endpoints", WORKLOG 2026-07-20).
4. **Vendor coupling** to Supabase's auth/storage/RLS conventions.

## 2. Goals

- G1 — A **Go HTTP API** owns all data access, authorization, business rules, AI calls, and
  file pipelines.
- G2 — **Next.js is frontend only**: rendering, routing, URL state, client cache. No database
  client, no secrets except the API's internal URL, no server actions that write data.
- G3 — **Behavioral parity**: every formula in `FORMULAS.md`, every journey in
  `QA-ONBOARDING.md` behaves identically after cutover. Same user IDs, same data, no forced
  password reset.
- G4 — **One implementation per formula** (Go `internal/domain`), shared golden test vectors.
- G5 — **Typed contract**: OpenAPI 3.1 generated from Go; the frontend client is generated
  from it. Contract drift fails CI.
- G6 — **Latest stable versions** of every package at start of work (see architecture §6).

## 3. Non-goals (v1)

- New features or UX redesign — the UI is ported, not reinvented. (Upgrades may force small
  visual diffs; those are bugs to fix, not features.)
- Native mobile app (the API enables it later).
- Per-user time zones — current behavior uses the server's local day (UTC in prod); v1 keeps
  that exact semantic, explicitly. See §9 risk R5.
- Replacing Postgres or changing the schema beyond what the port requires.
- Re-enabling community surfaces — the `community` flag stays **off**; its endpoints are
  ported but gated (same as today).

## 4. Users & roles (unchanged)

`student` (UI: "trainee"), `coach`, `both`, `admin` — from `profiles.role`. Coach features
require an **active** `coaching_relationships` row. Role-aware landing: coach → `/coaching`,
everyone else → `/dashboard`.

## 5. Functional requirements — API surface

Every server action and route handler maps to one endpoint. Paths are under `/v1`.
Mutations return the updated resource (or a `result` object mirroring today's action state:
`status: success | info | error`, `message`) so toasts keep working.

### 5.1 Auth & session
| Today | Endpoint |
| --- | --- |
| `registerAction` | `POST /auth/register` |
| `loginAction` | `POST /auth/login` → sets `__Host-coachin_session` cookie |
| `logoutAction` | `POST /auth/logout` |
| `getUser()` in pages | `GET /me` (profile + role + flags) |

Password rules unchanged: ≥ 8 chars, upper + lower + digit, email format.

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
| `generatePlanAction` (race) / `generateHypertrophyPlanAction` | `POST /training-plans` (`kind: race \| hypertrophy`, optional `studentId` for coach mode) |
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
| signed image URLs (today via Supabase storage) | `GET /photos/{id}/url` (short-lived signed URL) |
| `analyzePhotosAction`, `extractReportAction` | `POST /photos/analyze`, `POST /reports/extract` |
| `createGoalAction`, `abandonGoalAction`, `achieve_goal` RPC | `POST /goals`, `POST /goals/{id}/abandon`, `POST /goals/{id}/achieve` |
| profile page loaders (stats, XP history, charts) | `GET /me/overview`, `GET /me/progress` |

### 5.7 Coaching
| Today | Endpoint |
| --- | --- |
| `generateCoachInviteCodeAction` | `POST /coach/invite-codes` |
| `connectCoachByCodeAction` (`join_coaching_via_invite_code`) | `POST /coaching/join` → `created \| already_connected \| reactivated` |
| coaching hub loader | `GET /coach/trainees` (roster + adherence) |
| trainee nutrition / supplements (consent-gated) | `GET /coach/trainees/{id}/nutrition`, `…/supplements` |
| `assignCoachWeeklyPlanAction` | `POST /coach/trainees/{id}/weekly-plan` |

### 5.8 Community (flag-gated, `404` while off — same as today)
Clubs (`create`, `join by code`, `leave`, `set primary`), follows, training groups
(`create`, `join`, `leave`, `group_trained_today`, `evaluate_group_days`), leaderboard
(`get_weekly_leaderboard`), discover. Paths under `/community/*`.

### 5.9 Cross-cutting behavior
- **Idempotency**: every XP-awarding write stays idempotent by its FORMULAS.md reason key
  (`plan_item:<id>`, `meal_log:<id>`, `calorie_goal:<date>`, …). Enforced by a unique
  constraint, not just a pre-check.
- **Upload limits**: 8 MB request cap (matches `bodySizeLimit`); photo caps via DB trigger
  (body 5, progress 24) remain.
- **AI**: Claude primary, Gemini fallback, "AI is temporarily unavailable" when neither is
  configured — same contract as `lib/ai/README.md`.
- **Errors**: RFC 9457 problem+json; user-facing `detail` stays English-only.

## 6. Frontend requirements

- Every route in QA-ONBOARDING's module map renders server-side with data prefetched from
  the API (no loading flash on first paint), then hydrates into TanStack Query.
- URL-addressable state uses **nuqs**: profile `?tab=`, training `?student=`, calendar
  `?week=`, nutrition `?date=`, community tabs.
- Mutations use TanStack Query `useMutation`; toggles (plan item, supplement log) are
  optimistic with rollback.
- Toasts (sonner), theming (next-themes), PWA manifest + service worker, Storybook stories,
  share-card canvas rendering — all kept.
- The browser never holds an auth token in JS: session is an `HttpOnly; Secure;
  SameSite=Lax` cookie.

## 7. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | p95 API latency < 150 ms for non-AI reads at current data volume; Today page TTFB no worse than today |
| Security | Authorization enforced in Go **and** by RLS (defense in depth); secrets only in the API; rate-limit auth + AI + upload endpoints |
| Reliability | All multi-write operations in one DB transaction; AI calls time-boxed (60 s) with fallback |
| Observability | Structured `slog` JSON logs with request ID + user ID; `/healthz`, `/readyz`; OpenTelemetry-ready |
| Testability | Domain logic 100 % covered by golden vectors; integration tests on real Postgres (testcontainers) |
| Deployability | Go API: single static binary in a distroless image; web: Next `standalone` |

## 8. Acceptance criteria (definition of done for cutover)

1. All 216+ existing vitest cases for `lib/` logic have Go equivalents passing against the
   **same** golden vectors.
2. Every QA-ONBOARDING journey (1–8) passes end-to-end (Playwright) against web + Go API.
3. A user created before cutover logs in with their existing password; XP, streak, hearts,
   plans, photos all present and unchanged.
4. `apps/web` has no `@supabase/*`, `sharp`, `@anthropic-ai/sdk`, `@google/genai`,
   `@garmin/fitsdk`, or `fast-xml-parser` dependency and no `"use server"` data writes.
5. FORMULAS.md "source of truth" pointers reference Go files; SQL mirrors of formulas are
   dropped.
6. `openapi.json` in repo equals what the API emits (CI check).

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Formula drift during port (XP, streak, tiers, scorecard, nutrition targets) | Golden vectors exported from current TS tests; both suites run on them until TS copy is deleted |
| R2 | Authorization regressions — 92 RLS policies encode access rules | Keep RLS on: Go sets the RLS user context per transaction, so policies still enforce while Go adds explicit checks (architecture ADR-4) |
| R3 | User migration / password hashes | Same UUIDs; Supabase bcrypt hashes verified natively then rehashed to argon2id on login (ADR-3) |
| R4 | Big-bang cutover | Strangler: API built module-by-module; frontend switches module-by-module behind the same URLs |
| R5 | "Today" semantics — `lib/dates.ts` uses the server's local day | Go process runs with `TZ=UTC` pinned, matching Vercel; per-user TZ is a post-v1 item |
| R6 | TypeScript 7 (native) is latest but typescript-eslint 8.70 supports `<6.1` | Pin TS **6.0.3** for tooling; revisit when typescript-eslint ships TS 7 support |
| R7 | Image pipeline without `sharp` | Pure-Go decode/resize/re-encode (EXIF is dropped by re-encode); HEIC stays client-converted as today |

## 10. Open questions (defaults assumed in the plan)

1. **Hosting** — default: Go API on Fly.io/Railway/Cloud Run (any container host), web stays
   on Vercel. Postgres stays on Supabase-hosted Postgres at first (it's just Postgres).
2. **Leave Supabase entirely?** — default: yes for auth + storage (Phase 6), Postgres host
   can move later with zero code change.
3. **Email flows** (confirmation, password reset) — default: keep Supabase's current
   behavior until Phase 6, then add a transactional email provider.
