#!/bin/bash
set -euo pipefail
umask 077
database=irenee_staging
directory=/var/backups/irenee/daily
install -d -m 0700 "$directory"
exec 9>"$directory/.backup.lock"
flock -n 9 || exit 0
target="$directory/irenee-$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f -- "$target.partial"' EXIT
runuser -u postgres -- pg_dump --format=custom --dbname="$database" > "$target.partial"
pg_restore --list "$target.partial" > /dev/null
mv -- "$target.partial" "$target"
sha256sum "$target" > "$target.sha256"
echo "irenee_backup_verified $(basename "$target")"
# This directory belongs exclusively to this backup job. Historical manual
# backups outside it are untouched.
find "$directory" -maxdepth 1 -type f -name 'irenee-20??????T??????Z.dump*' -mtime +30 -delete
