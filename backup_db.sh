#!/bin/bash

# Configuration
# Detect local directory if running manually, otherwise set absolute path if needed
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_DIR="${SCRIPT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="locbook"
FILENAME="${BACKUP_DIR}/locbook_backup_${TIMESTAMP}.archive.gz"
CONTAINER_NAME_PATTERN="locbook-mongo" # Adjust if project name is different, or use label filter

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting backup for database: $DB_NAME"
echo "Timestamp: $TIMESTAMP"

# 1. Find Container ID
# Strategy: Look for container with label com.docker.compose.service=mongo AND project=locbook (implied by directory name usually)
# Fallback: Just look for any running container with image mongo if unique, or name pattern
CONTAINER_ID=$(docker ps -q -f "label=com.docker.compose.service=mongo" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: MongoDB container not found!"
    exit 1
fi

echo "Found Container ID: $CONTAINER_ID"

# 2. Execute mongodump via docker exec (streaming output to host)
docker exec "$CONTAINER_ID" mongodump \
    --db "$DB_NAME" \
    --archive \
    --gzip > "$FILENAME"

if [ $? -eq 0 ]; then
    echo "Backup successful: $FILENAME"
    ls -lh "$FILENAME"
    
    # Optional: Delete backups older than 7 days
    find "$BACKUP_DIR" -type f -name "locbook_backup_*.archive.gz" -mtime +7 -exec rm {} \;
    echo "Cleaned up old backups."
else
    echo "Backup failed!"
    # Remove empty/failed file
    rm -f "$FILENAME"
    exit 1
fi
