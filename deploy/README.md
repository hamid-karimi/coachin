# Deploy

Configuration the stack mounts (`caddy/`, `garage/`, `postgres/`, `backup/`, `e2e/`) and
the operations runbooks:

1. [Release images](#release-images)
2. [VPS bootstrap](#vps-bootstrap-one-time) (Ubuntu LTS)
3. [Deploy and upgrade](#deploy-and-upgrade)
4. [Backups and restore](#backups-and-restore)
5. [Go-live: import the Supabase data](#go-live-import-the-supabase-data-one-time)

The VPS runs `compose.yaml` alone (no `compose.dev.yaml`) on release images, with
`deploy/production.env.example` as its `.env`. Only Caddy publishes ports (80, 443 tcp+udp);
Postgres, Garage, the API, and the web app are reachable only inside the Docker network.

## Release images

Pushing a version tag publishes `ghcr.io/hamid-karimi/coachin-{api,web,backup}` for
`linux/amd64` and `linux/arm64` (`.github/workflows/release.yml`):

```bash
git checkout feat/backend-rewrite-with-go && git pull
git tag v1.0.0 && git push origin v1.0.0
```

Tags: `1.0.0`, `1.0`, and `sha-<commit>`. The packages start private: either make them
public (GitHub → Packages → package settings), or `docker login ghcr.io` on the VPS with a
token that has `read:packages`.

## VPS bootstrap (one-time)

A 2 vCPU / 4 GB server is plenty (amd64 or arm64). As `root` on a fresh Ubuntu LTS:

```bash
# Deploy user with your SSH key
adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy ~/.ssh/authorized_keys /home/deploy/.ssh/
usermod -aG sudo deploy && passwd deploy      # sudo password (SSH stays key-only)

# Security updates install themselves
apt update && apt -y full-upgrade
apt -y install unattended-upgrades make git
dpkg-reconfigure -plow unattended-upgrades

# Firewall: SSH + HTTP/HTTPS (+ HTTP/3) only
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable

# Docker Engine (official repository) + compact, rotated container logs
curl -fsSL https://get.docker.com | sh
echo '{ "log-driver": "local" }' > /etc/docker/daemon.json && systemctl restart docker
usermod -aG docker deploy
```

Check that `ssh deploy@<server>` works **in a second terminal**, then turn SSH key-only
and close root logins:

```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
systemctl reload ssh
```

DNS: point an `A` (and `AAAA`, if the server has IPv6) record for the domain at the server
**before** the first start — Caddy requests the certificate on startup.

As `deploy`:

```bash
sudo install -d -o deploy -g deploy /srv/coachin
git clone https://github.com/hamid-karimi/coachin.git /srv/coachin && cd /srv/coachin
git checkout v1.0.0                       # the release you deploy
cp deploy/production.env.example .env && chmod 600 .env
nano .env                                  # fill every <…>; keep BACKUP_PASSPHRASE off-server too
make deploy
```

`make deploy` pulls the images and starts everything; migrations and the storage bootstrap
run first on every start. https://your.domain/status should say "All systems go".

## Deploy and upgrade

```bash
cd /srv/coachin
git fetch --tags && git checkout v1.1.0   # compose.yaml / Caddyfile of that release
nano .env                                  # bump API_IMAGE / WEB_IMAGE / BACKUP_IMAGE to 1.1.0
make deploy
```

Rolling back is the same with the previous tag. Migrations only move forward on `up`; a
release that must undo one says so in its notes. Logs: `docker compose logs -f api`.

## Backups and restore

The `backup` service (on when `.env` has `COMPOSE_PROFILES=backup`) runs nightly at
`BACKUP_SCHEDULE` (UTC, default 03:00) and sends to the off-site bucket (`BACKUP_S3_*`,
any S3-compatible provider — Backblaze B2, Cloudflare R2, Hetzner, AWS):

- `db/coachin-<date>.dump` — a `pg_dump` of the whole database;
- `photos/current/` — a mirror of the photo bucket, and `photos/changed-<date>/` — the
  photos deleted or replaced that day;
- dumps and `changed-*` folders older than `BACKUP_RETENTION_DAYS` (14) are pruned.

Everything is encrypted (rclone crypt, file names included) with `BACKUP_PASSPHRASE`
before it leaves the server. **Without that passphrase the backups can't be read** — keep
a copy in a password manager.

```bash
make backup                  # one backup now (do it once after setup)
make backups                 # list the dumps kept off-site
make restore                 # stop api + web, restore the newest dump + the photos, start again
make restore DATE=2026-10-01 # a specific day's database
```

A restore replaces the database with the dump (`pg_restore --clean`, one transaction) and
the photo bucket with the latest mirror. Photos are not point-in-time: a photo deleted
after that day's dump is still in `photos/changed-<date>/` (for 14 days) if you need it.

**Restore onto a new server**: bootstrap it as above with the same `.env` (the
`BACKUP_*` values and passphrase), `make deploy` (a fresh, empty, migrated database), then
`make restore`.

**Test it** every few months: on your own machine, put the production `BACKUP_*` values in
the local `.env`, `make up`, then `make restore` and sign in with a real account at
http://localhost:8080.

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
   install (`make deploy` applies the migrations).
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
