-- The `app` schema holds infrastructure the whole database relies on.
-- Migrations run as the owner role (coachin_owner); the API connects as
-- coachin_app, which is not an owner, so row-level security applies to it.

-- +goose Up
CREATE SCHEMA IF NOT EXISTS app;

-- The signed-in user for the current transaction. The API sets it with
-- `SELECT set_config('app.user_id', '<uuid>', true)` inside store.WithUser;
-- RLS policies call this instead of Supabase's auth.uid(). NULL when unset,
-- so policies fail closed.
-- +goose StatementBegin
CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
-- +goose StatementEnd

GRANT USAGE ON SCHEMA public, app TO coachin_app;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO coachin_app;

-- Everything later migrations create is usable by the API role by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO coachin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO coachin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app
  GRANT EXECUTE ON FUNCTIONS TO coachin_app;

-- +goose Down
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app
  REVOKE EXECUTE ON FUNCTIONS FROM coachin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM coachin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM coachin_app;
REVOKE USAGE ON SCHEMA public FROM coachin_app;
DROP SCHEMA app CASCADE;
