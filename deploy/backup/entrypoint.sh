#!/bin/sh
# Wires the rclone remotes from the environment, then runs one command:
#   schedule (default)  nightly backups at $BACKUP_SCHEDULE (cron, UTC)
#   backup              one backup now
#   restore [YYYY-MM-DD] restore the database (latest dump by default) and photos
#   list                the dumps kept off-site
set -eu

: "${BACKUP_S3_ENDPOINT:?set BACKUP_S3_ENDPOINT in .env}"
: "${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET in .env}"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE in .env (keep a copy off the server)}"

# No rclone.conf: every remote comes from the environment.
export RCLONE_CONFIG=/dev/null

# garage: our bucket. offsite: an encrypted (rclone crypt) folder in the off-site bucket.
export RCLONE_CONFIG_GARAGE_TYPE=s3 RCLONE_CONFIG_GARAGE_PROVIDER=Other \
  RCLONE_CONFIG_GARAGE_ENDPOINT="$S3_ENDPOINT" RCLONE_CONFIG_GARAGE_REGION="$S3_REGION" \
  RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_GARAGE_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_OFFSITERAW_TYPE=s3 RCLONE_CONFIG_OFFSITERAW_PROVIDER=Other \
  RCLONE_CONFIG_OFFSITERAW_ENDPOINT="$BACKUP_S3_ENDPOINT" \
  RCLONE_CONFIG_OFFSITERAW_REGION="${BACKUP_S3_REGION:-auto}" \
  RCLONE_CONFIG_OFFSITERAW_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}" \
  RCLONE_CONFIG_OFFSITERAW_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}"
RCLONE_CONFIG_OFFSITE_PASSWORD="$(rclone obscure "$BACKUP_PASSPHRASE")"
export RCLONE_CONFIG_OFFSITE_TYPE=crypt RCLONE_CONFIG_OFFSITE_PASSWORD \
  RCLONE_CONFIG_OFFSITE_REMOTE="offsiteraw:$BACKUP_S3_BUCKET/coachin"

command="${1:-schedule}"
[ $# -gt 0 ] && shift
case "$command" in
  schedule)
    # crond starts jobs with an empty environment: hand them this one.
    export -p > /run/backup.env
    chmod 600 /run/backup.env
    echo "${BACKUP_SCHEDULE:-0 3 * * *} . /run/backup.env && backup.sh" > /etc/crontabs/root
    echo "backups scheduled: ${BACKUP_SCHEDULE:-0 3 * * *} (UTC)"
    exec crond -f -l 8
    ;;
  backup) exec backup.sh ;;
  restore) exec restore.sh "$@" ;;
  list) exec rclone lsf offsite:db ;;
  *) echo "unknown command $command (schedule, backup, restore, list)" >&2; exit 2 ;;
esac
