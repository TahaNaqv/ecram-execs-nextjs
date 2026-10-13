#!/usr/bin/env bash
# Nightly database backup. Install as the `postgres` user's cron job (see docs/server-setup.md §10).
# Keeps 14 days locally. A copy that lives only on the same server is not a backup: also copy
# /var/backups/ecram off the machine (rsync to another host, or an object-storage bucket).
set -euo pipefail
DIR=/var/backups/ecram
mkdir -p "$DIR"
STAMP=$(date +%F-%H%M)
pg_dump --format=custom --no-owner ecram > "$DIR/ecram-$STAMP.dump"
find "$DIR" -name 'ecram-*.dump' -mtime +14 -delete
echo "backup written: $DIR/ecram-$STAMP.dump ($(du -h "$DIR/ecram-$STAMP.dump" | cut -f1))"
