# Security review — Phase 5.2 (2026-09-25)

Scope: the rewrite stack on `feat/backend-rewrite-with-go` — auth, sessions, uploads,
authorization (Go checks + row-level security), the edge (Caddy), and secrets. Legacy code
was not reviewed (it is deleted in 5.3).

## Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | `profiles_select_authenticated` was `USING (true)`: any signed-in user's database session could read every profile — email, birth date, sex, height, weight, body fat, training history. The API never selected those columns for others, but RLS is the safety net for exactly that mistake. | Migration 00011: profiles are readable by their owner and by the other side of an **active** coaching relationship. Everyone else reads `profile_cards` (id, name, avatar, XP, level, tier) — a read-only, security-barrier view. Community, circle, people search, follows, and group members read the view. |
| 2 | High | `get_weekly_leaderboard` (SECURITY DEFINER, any ids) returned every user's **email**. | Recreated without the email column (nothing read it). |
| 3 | Medium | `clubs_select_authenticated` was `USING (true)`: every club, **invite code included**, was readable, so anyone could join any club. | Clubs are readable by their owner and members; joining by code still runs in `join_club_via_invite_code`. |
| 4 | Low | People search matched `lower(email)` on other users' rows (needs the private column). | `user_id_by_email(text)` returns only the id for an exact address. |
| 5 | Low | No security headers at the edge; Next.js sent `X-Powered-By`. | Caddy sets `nosniff`, `X-Frame-Options DENY`, `frame-ancestors 'none'` / `base-uri` / `form-action` / `object-src` CSP, a strict referrer policy, a restrictive `Permissions-Policy`, and strips `Server` / `X-Powered-By`; `poweredByHeader: false`. HSTS (1 year, subdomains) since 6.2. |
| 6 | Low | The new card view would have inherited `INSERT/UPDATE/DELETE` from the schema's default privileges — a simple view is auto-updatable and runs as its owner, i.e. a write path around RLS. | The migration revokes everything but `SELECT`; `TestProfilePrivacy` asserts a write through the view fails. |

`TestProfilePrivacy` (store, Postgres) pins 1–3 and 6: a stranger reads no private row but
the card, the coach reads the trainee's row, a non-member can't see a club, the owner can,
the leaderboard has no email, and the view refuses writes.

## Checked, no change needed

- **Passwords**: argon2id (PHC string); imported Supabase bcrypt hashes verify and are
  rehashed on the next login.
- **Sessions**: opaque random tokens, stored as SHA-256 hashes; cookie `HttpOnly`,
  `SameSite=Lax`, `Secure` + `__Host-` prefix in production (`COOKIE_SECURE=true`); password reset
  and change revoke the other sessions.
- **CSRF**: `http.NewCrossOriginProtection` rejects cross-site state-changing requests
  (Sec-Fetch-Site / Origin) in front of every route.
- **Rate limits**: per client IP — `proxiedClientIP` takes the last `X-Forwarded-For` hop,
  the one Caddy appends, so clients can't spoof it; auth, uploads, AI calls, and codes are
  limited.
- **Uploads**: multipart bodies capped (`MaxBytesReader`: 20 MB watch files, 32 MB photos,
  8 MB meal photos); image types sniffed from bytes; decompression bombs refused before
  decoding (40 MP); every image re-encoded (metadata dropped) and AI-moderated; objects are
  private and streamed after an ownership check.
- **Authorization**: every request runs as its user with RLS on (ADR-4); use cases check
  roles and coaching relationships explicitly; coach views need an active relationship
  and, for nutrition, the trainee's opt-in.
- **Cross-user SQL functions** (ADR-5 amendment): each does one step and checks the caller
  (`app.current_user_id()`), e.g. a code redemption can't target another user.
- **Admin surfaces**: Caddy's admin API is off; the API is reachable only through Caddy.

## Accepted

- Registering an existing email says "User already registered" (legacy behavior; the
  auth rate limit bounds enumeration). Same for exact-email people search.
- `sport_types` and `foods` stay readable by everyone (shared reference data).
