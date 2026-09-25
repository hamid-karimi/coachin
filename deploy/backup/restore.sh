#!/bin/sh
# Restores the database from an off-site dump (the newest, or the one dated
# $1 = YYYY-MM-DD) and the photo bucket from its latest off-site copy.
# Stop the api and web first (`make restore` does).
set -eu
if [ -n "${1:-}" ]; then
  file="coachin-$1.dump"
else
  file="$(rclone lsf offsite:db | sort | tail -n 1)"
fi
[ -n "$file" ] || { echo "no dumps found off-site" >&2; exit 1; }
dump="/tmp/$file"
trap 'rm -f "$dump"' EXIT

echo "restore: database from $file"
rclone copyto "offsite:db/$file" "$dump"
pg_restore --clean --if-exists --single-transaction --dbname="$PGDATABASE" "$dump"

echo "restore: photos (latest copy)"
rclone sync offsite:photos/current "garage:$S3_BUCKET"
echo "restore: done"
