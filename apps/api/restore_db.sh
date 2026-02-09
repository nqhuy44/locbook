#!/bin/bash

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_DIR="${SCRIPT_DIR}/backups"
DB_NAME="locbook"
DEFAULT_BACKUP_FILE="${BACKUP_DIR}/locbook_backup.archive.gz"

# Input file: Use argument or default
BACKUP_FILE="${1:-$DEFAULT_BACKUP_FILE}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE"
    echo "Usage: ./restore_db.sh [path_to_backup_file]"
    exit 1
fi

echo "Detailed Info:"
echo "  Database: $DB_NAME"
echo "  Source Field: $BACKUP_FILE"

# 1. Find Container ID
CONTAINER_ID=$(docker ps -q -f "label=com.docker.compose.service=mongo" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: MongoDB container not found! Is it running?"
    exit 1
fi

echo "Found Container ID: $CONTAINER_ID"

echo "WARNING: This will overwrite ('--drop') the existing database '$DB_NAME'."
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

echo "Starting restore..."

# 2. Execute mongorestore via docker exec (streaming input from host)
# --drop: Drops the collections before restoring from the archive
# --gzip: Decompresses the archive
# --archive: Reads from stdin
cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_ID" mongorestore \
    --gzip \
    --archive \
    --drop \
    --nsInclude="${DB_NAME}.*" # Restore only our DB

if [ $? -eq 0 ]; then
    echo "Restore completed successfully!"
else
    echo "Restore failed!"
    exit 1
fi
