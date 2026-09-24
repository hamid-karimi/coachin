#!/bin/sh
# Runs once, when the Postgres volume is first initialized.
# POSTGRES_USER (coachin_owner) owns the database and runs migrations; the API
# connects as coachin_app, a non-owner, so row-level security applies to it.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE coachin_app LOGIN PASSWORD :'app_password';
SQL
