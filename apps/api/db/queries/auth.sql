-- Accounts, sessions, and email tokens. Run with the coachin_auth pool.

-- name: CreateUser :one
INSERT INTO public.users (email, password_hash)
VALUES (sqlc.arg(email)::citext, sqlc.arg(password_hash))
RETURNING id, email::text AS email, created_at;

-- name: CreateProfile :exec
INSERT INTO public.profiles (id, email, full_name)
VALUES (sqlc.arg(id), sqlc.arg(email), sqlc.arg(full_name));

-- name: GetUserByEmail :one
SELECT id, email::text AS email, password_hash, email_verified_at
FROM public.users
WHERE email = sqlc.arg(email)::citext;

-- name: GetUserByID :one
SELECT id, email::text AS email, password_hash, email_verified_at
FROM public.users
WHERE id = sqlc.arg(id);

-- name: UpdatePasswordHash :exec
UPDATE public.users SET password_hash = sqlc.arg(password_hash), updated_at = now()
WHERE id = sqlc.arg(id);

-- name: MarkEmailVerified :exec
UPDATE public.users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
WHERE id = sqlc.arg(id);

-- name: CreateSession :exec
INSERT INTO app.sessions (id_hash, user_id, expires_at, user_agent, ip)
VALUES (sqlc.arg(id_hash), sqlc.arg(user_id), sqlc.arg(expires_at), sqlc.narg(user_agent), sqlc.narg(ip)::inet);

-- name: GetSession :one
SELECT user_id, last_seen_at, expires_at
FROM app.sessions
WHERE id_hash = sqlc.arg(id_hash) AND expires_at > now();

-- name: TouchSession :exec
UPDATE app.sessions SET last_seen_at = now(), expires_at = sqlc.arg(expires_at)
WHERE id_hash = sqlc.arg(id_hash);

-- name: DeleteSession :exec
DELETE FROM app.sessions WHERE id_hash = sqlc.arg(id_hash);

-- name: DeleteUserSessions :exec
DELETE FROM app.sessions WHERE user_id = sqlc.arg(user_id);

-- name: DeleteOtherUserSessions :exec
DELETE FROM app.sessions WHERE user_id = sqlc.arg(user_id) AND id_hash <> sqlc.arg(keep_id_hash);

-- name: CreateAuthToken :exec
INSERT INTO app.auth_tokens (token_hash, user_id, purpose, expires_at)
VALUES (sqlc.arg(token_hash), sqlc.arg(user_id), sqlc.arg(purpose), sqlc.arg(expires_at));

-- name: ConsumeAuthToken :one
-- Marks a valid, unused token as used and returns its user; no row when the
-- token is unknown, expired, already used, or for another purpose.
UPDATE app.auth_tokens SET used_at = now()
WHERE token_hash = sqlc.arg(token_hash)
  AND purpose = sqlc.arg(purpose)
  AND used_at IS NULL
  AND expires_at > now()
RETURNING user_id;

-- name: GetProfileSummary :one
SELECT full_name, role FROM public.profiles WHERE id = sqlc.arg(id);
