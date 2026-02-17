#!/bin/bash

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Database Configs
POSTGRES_USER="postgres"
POSTGRES_DB_NAME="spotary"
POSTGRES_CONTAINER_LABEL="com.docker.compose.service=postgres"

# Inputs
BACKUP_FILE="$1"

usage() {
    echo "Usage: ./restore_db.sh <backup_file>"
    echo "  <backup_file>: Path to the postgres backup file (.sql.gz)"
    exit 1
}

if [ -z "$BACKUP_FILE" ]; then
    usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE"
    exit 1
fi

confirm() {
    echo "WARNING: This will OVERWRITE the existing 'spotary' database."
    echo "Target: $BACKUP_FILE"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restore cancelled."
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
    echo "Resetting public schema..."
    docker exec -i "$container_id" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    
    echo "Importing data..."
    # Portable zcat/gzcat
    if command -v gzcat >/dev/null 2>&1; then
        ZCAT="gzcat"
    else
        ZCAT="zcat"
    fi
    $ZCAT "$BACKUP_FILE" | docker exec -i "$container_id" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME"
    
    if [ $? -eq 0 ]; then
        echo "PostgreSQL restore completed successfully!"
    else
        echo "PostgreSQL restore failed!"
        exit 1
    fi
}

restore_postgres
