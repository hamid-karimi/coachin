# Off-site backups (Phase 6.3): pg_dump from the Postgres image (matches the
# server) + rclone. Nightly via crond; `backup`, `restore`, `list` by hand.
FROM rclone/rclone:1.71.1 AS rclone

FROM postgres:18.6-alpine
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY entrypoint.sh backup.sh restore.sh /usr/local/bin/
ENTRYPOINT ["entrypoint.sh"]
CMD ["schedule"]
