#!/usr/bin/env bash
set -euo pipefail
umask 077
target=/opt/apostolos/backups
install -d -m 700 "$target"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary="$target/.database-$stamp.partial"
docker exec apostolos-database pg_dump -U postgres -d apostolos -Fc > "$temporary"
test -s "$temporary"
mv -- "$temporary" "$target/database-$stamp.dump"
docker run --rm --network none --mount source=apostolos-avatars,target=/data,readonly \
  --mount type=bind,source="$target",target=/backup postgres:17-alpine \
  tar -czf "/backup/avatars-$stamp.tar.gz" -C /data .
sha256sum "$target/database-$stamp.dump" "$target/avatars-$stamp.tar.gz" > "$target/backup-$stamp.sha256"
printf 'Backup completed: %s\n' "$stamp"
