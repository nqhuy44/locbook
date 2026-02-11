#!/bin/bash

# LocBook - Manual Vector DB Re-index Script
# Usage: ./reindex_db.sh

echo "Starting Vector DB Re-indexing..."

# Ensure we are in the project root
cd "$(dirname "$0")"

# Check if running in Docker environment (by checking if 'app' container is up)
# Assumes container name contains "locbook-app" or similar if using docker compose default naming
# Or we can check if "docker compose" is available and service "app" is running.

CONTAINER_ID=$(docker compose ps -q app 2>/dev/null)

if [ ! -z "$CONTAINER_ID" ]; then
    echo "🐳 Docker container found ($CONTAINER_ID). Executing inside container..."
    docker compose exec -T app python src/scripts/reindex_vectors.py
else
    echo "💻 Running locally..."
    # Check for venv
    if [ -d "venv" ]; then
        echo "Using virtual environment..."
        PYTHON_CMD="./venv/bin/python"
    else
        echo "Virtual environment not found, using system python3..."
        PYTHON_CMD="python3"
    fi

    # Run the script with PYTHONPATH set to current directory
    export PYTHONPATH=.
    export ANONYMIZED_TELEMETRY=False
    $PYTHON_CMD src/scripts/reindex_vectors.py
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Re-indexing completed successfully."
else
    echo "❌ Re-indexing failed."
    exit $EXIT_CODE
fi
