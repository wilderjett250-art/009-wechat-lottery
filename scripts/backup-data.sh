#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$PROJECT_ROOT/data"}
BACKUP_DIR=${BACKUP_DIR:-"$PROJECT_ROOT/backups"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
SOURCE="$DATA_DIR/db.json"

umask 077
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u '+%Y%m%d-%H%M%S')

if docker compose ps --services --status running 2>/dev/null | grep -qx 'mysql'; then
  TARGET="$BACKUP_DIR/db-$STAMP.sql"
  TEMP="$TARGET.tmp"
  docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction --routines --events -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > "$TEMP"
  mv "$TEMP" "$TARGET"
else
  if [ ! -f "$SOURCE" ]; then
    echo "Runtime database not found: $SOURCE" >&2
    exit 1
  fi
  TARGET="$BACKUP_DIR/db-$STAMP.json"
  TEMP="$TARGET.tmp"
  cp "$SOURCE" "$TEMP"
  mv "$TEMP" "$TARGET"
fi

sha256sum "$TARGET" > "$TARGET.sha256"

find "$BACKUP_DIR" -type f \( -name 'db-*.json' -o -name 'db-*.sql' -o -name 'db-*.json.sha256' -o -name 'db-*.sql.sha256' \) -mtime "+$RETENTION_DAYS" -delete
printf 'Backup: %s\nSHA256: %s\n' "$TARGET" "$(cut -d ' ' -f 1 "$TARGET.sha256")"
