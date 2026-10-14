#!/usr/bin/env bash
# Nightly backups. Installed twice (see docs/server-setup.md §10), because two different users hold the data:
#   - as the `postgres` user  → dumps the database
#   - as `root`               → archives the driver documents (a folder only the app user and root can read)
# Keeps 14 days locally. A copy that lives only on the same server is not a backup: also copy /var/backups/ecram
# off the machine (rsync to another host, or an object-storage bucket).
# Note for GDPR: archives keep a document for up to 14 days after it is deleted from the site.
set -euo pipefail
umask 077            # backups hold personal data: readable by their owner only
DIR=/var/backups/ecram
STAMP=$(date +%F-%H%M)

if [ "$(id -u)" = "0" ]; then
  # Follow DOCUMENTS_DIR from the app's own settings, so a changed location is still backed up
  DOCS=$(grep -E '^DOCUMENTS_DIR=' /srv/ecram-execs/.env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  DOCS=${DOCS:-/var/lib/ecram-execs/documents}
  if [ -d "$DOCS" ]; then
    install -d -m 700 -o postgres -g postgres "$DIR"
    # tar exits 1 when a file changed while being read (an upload landing mid-backup): the archive is still good
    status=0
    tar -czf "$DIR/documents-$STAMP.tar.gz" -C "$(dirname "$DOCS")" "$(basename "$DOCS")" || status=$?
    [ "$status" -le 1 ] || { echo "documents backup FAILED (tar exit $status)" >&2; exit "$status"; }
    find "$DIR" -name 'documents-*.tar.gz' -mtime +14 -delete
    echo "documents backup written: $DIR/documents-$STAMP.tar.gz ($(du -h "$DIR/documents-$STAMP.tar.gz" | cut -f1))"
  else
    echo "no documents folder at $DOCS: nothing to back up"
  fi
else
  mkdir -p "$DIR"
  pg_dump --format=custom --no-owner ecram > "$DIR/ecram-$STAMP.dump"
  find "$DIR" -name 'ecram-*.dump' -mtime +14 -delete
  echo "database backup written: $DIR/ecram-$STAMP.dump ($(du -h "$DIR/ecram-$STAMP.dump" | cut -f1))"
fi
