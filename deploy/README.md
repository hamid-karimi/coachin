# Deploy

Configuration the stack mounts (`caddy/`, `garage/`, `postgres/`, `e2e/`) and the
operations runbooks.

## Go-live: import the Supabase data (one-time)

`make import-supabase` copies the legacy Supabase project into a **freshly migrated,
empty** database (`api import-supabase`, run from the API image — no Go needed):

- `auth.users` → `users`: same ids and emails; bcrypt password hashes are kept, so
  everyone signs in with their current password (rehashed to argon2id on that login).
  Accounts without a password (magic link) get an unusable one and sign in after
  "Forgot password".
- Every `public` table both schemas share, column by column, in one transaction with
  triggers and FK checks off. Reference tables seeded by the migrations (sport types,
  foods) are replaced by the source's rows; sequences move past the imported ids.
  Source-only tables are listed as skipped; source-only columns are dropped.
- Repeated once-only XP ledger reasons are relabeled `#dup<n>` (amounts kept), as
  migration 00009 did.
- Photos: each `body_photos.storage_path` object is copied from Supabase Storage to the
  same key in Garage. A missing object is reported, not fatal.

It refuses a target that already has users, so it can't run twice by accident.

### Steps

1. In `.env`, fill the `SUPABASE_*` block (see `.env.example`): the direct database
   connection, and the Storage S3 connection for the photos.
2. Start from an empty, migrated database: `make reset-db` locally; on the VPS, a fresh
   install (`docker compose up -d` applies the migrations).
3. Rehearse — copies inside a transaction, prints the counts, and rolls back:

   ```bash
   make import-supabase ARGS=-dry-run
   ```

   Check the per-table row counts against Supabase, `without_password`, the skipped
   tables, and `profiles_whose_xp_differs_from_ledger` (should be 0).
4. Import for real (during the maintenance window, with the old app read-only):

   ```bash
   make import-supabase
   ```

5. Spot-check: sign in as a known user with their old password; their XP, streak,
   plans, logs, and progress photos match the old app.
