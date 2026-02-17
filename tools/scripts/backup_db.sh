#!/bin/bash

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "${SCRIPT_DIR}/../../docker-compose.yml" ]; then
    PROJECT_ROOT="${SCRIPT_DIR}/../../"
elif [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
    PROJECT_ROOT="${SCRIPT_DIR}"
else
    PROJECT_ROOT="${SCRIPT_DIR}/../../"
fi

PROJECT_ROOT=$(readlink -f "$PROJECT_ROOT")
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Database Configs
POSTGRES_USER="postgres"
POSTGRES_DB_NAME="spotary"
POSTGRES_CONTAINER_LABEL="com.docker.compose.service=postgres"

# Directories to backup (relative to PROJECT_ROOT)
DIRS_TO_BACKUP=("pgdata" "redisdata")

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log_message() {
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $1"
}

backup_postgres() {
    local backup_file="${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz"
    log_message "Starting PostgreSQL backup..."
    
    local container_id=$(docker ps -q -f "label=${POSTGRES_CONTAINER_LABEL}" | head -n 1)
    if [ -z "$container_id" ]; then
        log_message "Error: PostgreSQL container not found!"
        return 1
    fi
    
    log_message "Found PostgreSQL Container ID: $container_id"
    local temp_file="${backup_file%.gz}"
    
    if docker exec "$container_id" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB_NAME" > "$temp_file"; then
        if [ ! -s "$temp_file" ]; then
             log_message "Error: PostgreSQL backup produced empty file!"
             rm -f "$temp_file"
             return 1
        fi
        gzip "$temp_file"
        log_message "PostgreSQL backup successful: $backup_file"
        find "$BACKUP_DIR" -type f -name "postgres_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm {} \;
    else
        log_message "Error: PostgreSQL backup failed!"
        rm -f "$backup_file" "$temp_file"
        return 1
    fi
}

backup_directories() {
    log_message "Starting Directory backups..."
    local status=0
    for dir_name in "${DIRS_TO_BACKUP[@]}"; do
        local source_dir="${PROJECT_ROOT}/${dir_name}"
        local backup_file="${BACKUP_DIR}/${dir_name}_${TIMESTAMP}.zip"
        if [ ! -d "$source_dir" ]; then
            log_message "Warning: Directory not found: $source_dir. Skipping."
            continue
        fi
        log_message "Backing up directory: $dir_name"
        pushd "$PROJECT_ROOT" > /dev/null
        if zip -q -r "$backup_file" "$dir_name"; then
            log_message "Backup successful: $backup_file"
            find "$BACKUP_DIR" -type f -name "${dir_name}_*.zip" -mtime +${RETENTION_DAYS} -exec rm {} \;
        else
            log_message "Error: Backup failed for $dir_name!"
            rm -f "$backup_file"
            status=1
        fi
        popd > /dev/null
    done
    return $status
}

main() {
    log_message "Starting Spotary Backup Process..."
    log_message "Project Root: $PROJECT_ROOT"
    local exit_code=0
    backup_postgres || exit_code=1
    backup_directories || exit_code=1
    if [ $exit_code -eq 0 ]; then
        log_message "All backups completed successfully."
        exit 0
    else
        log_message "One or more backups failed."
        exit 1
    fi
}

main
