#!/bin/bash

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Database Configs (Same as backup script)
MONGO_DB_NAME="locbook"
MONGO_CONTAINER_LABEL="com.docker.compose.service=mongo"

POSTGRES_USER="postgres"
POSTGRES_DB_NAME="locbook"
POSTGRES_CONTAINER_LABEL="com.docker.compose.service=postgres"

# Inputs
RESTORE_TYPE="$1" # 'mongo' or 'postgres'
BACKUP_FILE="$2"

usage() {
    echo "Usage: ./restore_db.sh <type> <backup_file>"
    echo "  <type>: mongo | postgres"
    echo "  <backup_file>: Path to the backup file"
    exit 1
}

if [ -z "$RESTORE_TYPE" ] || [ -z "$BACKUP_FILE" ]; then
    usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE"
    exit 1
fi

confirm() {
    echo "WARNING: This will OVERWRITE the existing '$RESTORE_TYPE' database."
    echo "Target: $BACKUP_FILE"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restore cancelled."
        exit 1
    fi
}

restore_mongo() {
    local container_id=$(docker ps -q -f "label=${MONGO_CONTAINER_LABEL}" | head -n 1)
    if [ -z "$container_id" ]; then
        echo "Error: MongoDB container not found!"
        exit 1
    fi
    
    echo "Found MongoDB Container ID: $container_id"
    confirm
    
    echo "Starting MongoDB restore..."
    # --drop: Drops the collections before restoring from the archive
    # --gzip: Decompresses the archive
    # --archive: Reads from stdin
    cat "$BACKUP_FILE" | docker exec -i "$container_id" mongorestore \
        --gzip \
        --archive \
        --drop \
        --nsInclude="${MONGO_DB_NAME}.*"
        
    if [ $? -eq 0 ]; then
        echo "MongoDB restore completed successfully!"
    else
        echo "MongoDB restore failed!"
        exit 1
    fi
}

restore_postgres() {
    local container_id=$(docker ps -q -f "label=${POSTGRES_CONTAINER_LABEL}" | head -n 1)
    if [ -z "$container_id" ]; then
        echo "Error: PostgreSQL container not found!"
        exit 1
    fi
    
    echo "Found PostgreSQL Container ID: $container_id"
    confirm
    
    echo "Starting PostgreSQL restore..."
    
    # Drop and recreate schema/tables is handled by pg_restore/psql usually if --clean is used, 
    # but since we did a plain sql dump (pg_dump without format flags usually defaults to plain text),
    # we heavily rely on the dump file having 'DROP TABLE IF EXISTS' etc.
    # However, pg_dump default doesn't always include DROP DATABASE.
    # Safe bet for full restore is often to drop and recreate the DB, or drop schema public cascade.
    # For now, let's assume the dump (from restore_db logic which uses default pg_dump)
    # writes Create statements. If tables exist, it might error.
    # Best practice for overwrite:
    # 1. Terminate connections (optional/hard via docker)
    # 2. Drop DB / Create DB OR Drop Schema.
    # Let's try to just pipe it in. If backup was created with --clean it would be easier.
    # Since we control the backup script, we should probably ensure backup has --clean or handle it here.
    # Current backup script uses `pg_dump -U ... locbook`. This is a plain dump.
    # It does NOT include --clean by default.
    # So we should probably drop schema public cascade first.
    
    echo "Resetting public schema..."
    docker exec -i "$container_id" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    
    echo "Importing data..."
    # ungzip -> psql
    zcat "$BACKUP_FILE" | docker exec -i "$container_id" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME"
    
    if [ $? -eq 0 ]; then
        echo "PostgreSQL restore completed successfully!"
    else
        echo "PostgreSQL restore failed!"
        exit 1
    fi
}

case "$RESTORE_TYPE" in
    mongo)
        restore_mongo
        ;;
    postgres)
        restore_postgres
        ;;
    *)
        echo "Error: Invalid type '$RESTORE_TYPE'."
        usage
        ;;
esac
