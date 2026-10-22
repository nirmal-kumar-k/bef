#!/usr/bin/env bash
#
# Postgres backup for BEF.
#
# Takes a compressed logical dump, verifies it actually parses, and prunes old
# ones. An unverified dump is not a backup - pg_restore --list is what proves
# the file is readable, so a silently truncated or zero-byte dump cannot pass
# as a good one.
#
# Usage:
#   ./scripts/backup-db.sh            # uses DATABASE_URL from .env.local
#   BACKUP_DIR=/mnt/x ./scripts/backup-db.sh
#
# Schedule daily at 01:30 (see the crontab line at the bottom of this file).

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/bef-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# --- resolve the connection string -------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$APP_DIR/.env.local" ]]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env.local" | cut -d '=' -f2- | tr -d '"' | tr -d "'")"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set and not found in $APP_DIR/.env.local" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d-%H%M%S)"
OUT="$BACKUP_DIR/bef-$STAMP.dump"

echo "[$(date -Is)] backing up -> $OUT"

# -Fc = custom format: compressed, and restorable selectively with pg_restore.
if ! pg_dump "$DATABASE_URL" -Fc -f "$OUT"; then
  echo "ERROR: pg_dump failed; removing partial file" >&2
  rm -f "$OUT"
  exit 1
fi

# --- verify ------------------------------------------------------------------
# A dump that cannot be listed is worthless. Fail loudly rather than leaving a
# corrupt file sitting in the backup directory looking legitimate.
if ! pg_restore --list "$OUT" >/dev/null 2>&1; then
  echo "ERROR: dump did not verify - $OUT is unreadable, removing it" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
TABLES="$(pg_restore --list "$OUT" | grep -c 'TABLE DATA' || true)"
echo "[$(date -Is)] OK: $SIZE, $TABLES tables with data"

# Refuse to silently succeed on an empty database - almost always a sign the
# connection string points somewhere unintended.
if [[ "$TABLES" -eq 0 ]]; then
  echo "WARNING: dump contains no table data. Check DATABASE_URL points at the right database." >&2
fi

# --- prune -------------------------------------------------------------------
# Only ever deletes files this script's own naming scheme produced.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'bef-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[$(date -Is)] pruned $DELETED backup(s) older than $RETENTION_DAYS days"
echo "[$(date -Is)] retained: $(find "$BACKUP_DIR" -maxdepth 1 -name 'bef-*.dump' -type f | wc -l) file(s)"

# -----------------------------------------------------------------------------
# To schedule daily at 01:30:
#   crontab -e
#   30 1 * * * /home/azureuser/babufoundry/scripts/backup-db.sh >> /home/azureuser/bef-backup.log 2>&1
#
# To restore (DESTRUCTIVE - overwrites the target database):
#   pg_restore --clean --if-exists -d "$DATABASE_URL" ~/bef-backups/bef-YYYY-MM-DD-HHMMSS.dump
#
# Practise a restore into a scratch database at least once. A backup whose
# restore has never been run is an assumption, not a recovery plan.
