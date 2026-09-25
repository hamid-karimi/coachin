#!/bin/sh
# One backup: a database dump and the photo bucket, to the encrypted off-site
# remote; dumps and replaced photos older than $BACKUP_RETENTION_DAYS are pruned.
set -eu
day="$(date -u +%F)"
keep="${BACKUP_RETENTION_DAYS:-14}"
cutoff="$(date -u -d "@$(( $(date +%s) - keep * 86400 ))" +%F)"
dump="/tmp/coachin-$day.dump"
trap 'rm -f "$dump"' EXIT

echo "backup $day: database"
pg_dump --format=custom --file="$dump"
rclone copyto "$dump" "offsite:db/coachin-$day.dump"

echo "backup $day: photos"
# Photos deleted or replaced since the last run move to changed-<day>/.
rclone sync "garage:$S3_BUCKET" offsite:photos/current --backup-dir "offsite:photos/changed-$day"

# older YYYY-MM-DD: true when the date is before the cutoff (anything else: false).
older() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) [ "$(echo "$1" | tr -d -)" -lt "$(echo "$cutoff" | tr -d -)" ] ;;
    *) return 1 ;;
  esac
}

echo "backup $day: keep $keep days (drop anything dated before $cutoff)"
for file in $(rclone lsf offsite:db); do
  dated="${file#coachin-}"
  if older "${dated%.dump}"; then rclone deletefile "offsite:db/$file"; fi
done
for dir in $(rclone lsf --dirs-only offsite:photos); do
  dated="${dir#changed-}"
  if older "${dated%/}"; then rclone purge "offsite:photos/$dir"; fi
done

if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
  wget -q -O /dev/null "$BACKUP_HEALTHCHECK_URL" || echo "healthcheck ping failed" >&2
fi
echo "backup $day: done"
