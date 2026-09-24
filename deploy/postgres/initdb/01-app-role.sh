#!/bin/sh
# Runs once, when the Postgres volume is first initialized.
#   coachin_owner (POSTGRES_USER)  owns the schema and runs migrations
#   coachin_app                    the API's everyday role; RLS applies to it
#   coachin_auth                   login/registration only: reads accounts and
#                                  sessions before any user context exists, so it
#                                  bypasses RLS but is granted just those tables
#                                  (see 00004_auth.sql)
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" \
  -v auth_password="$AUTH_DB_PASSWORD" <<'SQL'
CREATE ROLE coachin_app LOGIN PASSWORD :'app_password';
CREATE ROLE coachin_auth LOGIN BYPASSRLS PASSWORD :'auth_password';
SQL
