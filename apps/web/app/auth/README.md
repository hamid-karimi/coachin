# Auth (web)

Screens for the Go API's cookie sessions (`/api/v1/auth/*`). The API sets and clears
the HttpOnly session cookie; the web app never sees the token.

| Route | What | API |
| --- | --- | --- |
| `/auth/login` | Email + password; success → `/`, which routes by role | `POST /auth/login` |
| `/auth/register` | Sign up with the live password checklist; signed in right away | `POST /auth/register` |
| `/auth/forgot-password` | Always the same success message (no account probing) | `POST /auth/password/forgot` |
| `/auth/reset-password?token=` | New password from the mailed link; signs out other sessions | `POST /auth/password/reset` |
| `/auth/verify-email?token=` | Server-side confirm, shows the result | `POST /auth/verify-email` |
| `/profile` | Change password (keeps this session) and log out | `POST /auth/password/change`, `/auth/logout` |

Routing:
- `proxy.ts` sends visitors **without a session cookie** away from app pages to
  `/auth/login` — a cheap optimistic check (`lib/session-routing.ts`).
- The `(app)` layout does the real check with `GET /me` (`app/lib/me-data.ts`) and
  redirects on 401, so a stale cookie costs one redirect, never a loop.
- Login, register, and forgot-password send a live session to its home
  (`homeFor(role)`: coach → `/coaching`, everyone else → `/dashboard`).

Forms: react-hook-form + zod (`lib/auth-schemas.ts`), with the legacy validation messages;
API errors show the problem `detail` (`lib/api/problem.ts`).
