#!/bin/bash

# Configuration
# Detect where the script is running from to find project root
# If running from tools/scripts/, root is ../../
# If running from root/, root is .
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "${SCRIPT_DIR}/../../docker-compose.yml" ]; then
    PROJECT_ROOT="${SCRIPT_DIR}/../../"
elif [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
    PROJECT_ROOT="${SCRIPT_DIR}"
else
    # Fallback to assuming tools/scripts structure
    PROJECT_ROOT="${SCRIPT_DIR}/../../"
fi

# Resolve absolute path
PROJECT_ROOT=$(readlink -f "$PROJECT_ROOT")
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Database Configs
MONGO_DB_NAME="locbook"
MONGO_CONTAINER_LABEL="com.docker.compose.service=mongo"

POSTGRES_USER="postgres"
POSTGRES_DB_NAME="locbook"
POSTGRES_CONTAINER_LABEL="com.docker.compose.service=postgres"

# Directories to backup (relative to PROJECT_ROOT)
DIRS_TO_BACKUP=("data")

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log_message() {
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $1"
}

backup_mongodb() {
    local backup_file="${BACKUP_DIR}/mongodb_${TIMESTAMP}.archive.gz"
    
    log_message "Starting MongoDB backup..."
    
    # Find container ID
    local container_id=$(docker ps -q -f "label=${MONGO_CONTAINER_LABEL}" | head -n 1)
    
    if [ -z "$container_id" ]; then
        log_message "Error: MongoDB container not found!"
        return 1
    fi
    
    log_message "Found MongoDB Container ID: $container_id"
    
    # Execute mongodump
    if docker exec "$container_id" mongodump \
        --db "$MONGO_DB_NAME" \
        --archive \
        --gzip > "$backup_file"; then
        
        log_message "MongoDB backup successful: $backup_file"
        ls -lh "$backup_file"
        
        # Cleanup old backups
        find "$BACKUP_DIR" -type f -name "mongodb_*.archive.gz" -mtime +${RETENTION_DAYS} -exec rm {} \;
        log_message "Cleaned up MongoDB backups older than ${RETENTION_DAYS} days."
    else
        log_message "Error: MongoDB backup failed!"
        rm -f "$backup_file"
        return 1
    fi
}

backup_postgres() {
    local backup_file="${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz"
    
    log_message "Starting PostgreSQL backup..."
    
    # Find container ID
    local container_id=$(docker ps -q -f "label=${POSTGRES_CONTAINER_LABEL}" | head -n 1)
    
    if [ -z "$container_id" ]; then
        log_message "Error: PostgreSQL container not found!"
        return 1
    fi
    
    log_message "Found PostgreSQL Container ID: $container_id"
    
    # Execute pg_dump
    # Use a temporary uncompressed file to ensure pg_dump success before gzipping
    local temp_file="${backup_file%.gz}"
    
    if docker exec "$container_id" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB_NAME" > "$temp_file"; then
        # Check if docker exec failed (it might return 0 but print to stderr if using specific flags, but usually non-0 on error)
        # Actually, docker exec returns the exit code of the command.
        
        # Check if file has content (schema dump should be > 0 bytes)
        if [ ! -s "$temp_file" ]; then
             log_message "Error: PostgreSQL backup produced empty file!"
             rm -f "$temp_file"
             return 1
        fi
        
        # Compress
        gzip "$temp_file"
        
        log_message "PostgreSQL backup successful: $backup_file"
        ls -lh "$backup_file"
        
        # Cleanup old backups
        find "$BACKUP_DIR" -type f -name "postgres_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm {} \;
        log_message "Cleaned up PostgreSQL backups older than ${RETENTION_DAYS} days."
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
        
        # Zip the directory
        pushd "$PROJECT_ROOT" > /dev/null
        if zip -q -r "$backup_file" "$dir_name"; then
            log_message "Backup successful: $backup_file"
            ls -lh "$backup_file"
            
            # Cleanup old backups
            find "$BACKUP_DIR" -type f -name "${dir_name}_*.zip" -mtime +${RETENTION_DAYS} -exec rm {} \;
            log_message "Cleaned up ${dir_name} backups older than ${RETENTION_DAYS} days."
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
    log_message "Starting Backup Process..."
    log_message "Project Root: $PROJECT_ROOT"
    
    # Track overall status
    local exit_code=0
    
    backup_mongodb || exit_code=1
    backup_postgres || exit_code=1
    backup_directories || exit_code=1
    
    # Final status report
    if [ $exit_code -eq 0 ]; then
        log_message "All backups completed successfully."
        exit 0
    else
        log_message "One or more backups failed."
        exit 1
    fi
}

main
