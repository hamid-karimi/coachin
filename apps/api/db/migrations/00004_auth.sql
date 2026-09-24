-- Accounts, sessions, and one-time email tokens for the API's own auth
-- (ADR-3). Sessions and tokens live in the `app` schema, which coachin_app
-- cannot read; only coachin_auth (login/registration) touches them.

-- +goose Up
CREATE TABLE app.sessions (
    -- SHA-256 of the opaque cookie token; the token itself is never stored.
    id_hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    user_agent text,
    ip inet
);
CREATE INDEX sessions_user_id_idx ON app.sessions (user_id);

CREATE TABLE app.auth_tokens (
    -- SHA-256 of the emailed token; single use.
    token_hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz
);
CREATE INDEX auth_tokens_user_purpose_idx ON app.auth_tokens (user_id, purpose);

GRANT USAGE ON SCHEMA public, app TO coachin_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.sessions, app.auth_tokens TO coachin_auth;
GRANT SELECT, INSERT, UPDATE ON public.users TO coachin_auth;
-- Registration creates the profile (the legacy app relied on a trigger that
-- was never in a migration).
GRANT SELECT (id, role, full_name, email), INSERT (id, email, full_name) ON public.profiles TO coachin_auth;

-- The everyday API role never needs password hashes, even its own user's.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM coachin_app;
GRANT SELECT (id, email, email_verified_at, created_at) ON public.users TO coachin_app;

-- +goose Down
REVOKE SELECT (id, email, email_verified_at, created_at) ON public.users FROM coachin_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO coachin_app;
REVOKE ALL ON public.profiles FROM coachin_auth;
REVOKE ALL ON public.users FROM coachin_auth;
DROP TABLE app.auth_tokens;
DROP TABLE app.sessions;
REVOKE USAGE ON SCHEMA public, app FROM coachin_auth;
