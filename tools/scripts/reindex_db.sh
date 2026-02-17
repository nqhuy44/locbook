#!/bin/bash

# Spotary - Manual Vector DB Re-index Script
# Usage: ./tools/scripts/reindex_db.sh

echo "🚀 Starting Spotary Vector DB Re-indexing..."

# Ensure we are in the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT=$(readlink -f "${SCRIPT_DIR}/../../")
cd "$PROJECT_ROOT"

# Check if running in Docker environment
CONTAINER_ID=$(docker compose ps -q api 2>/dev/null)

if [ ! -z "$CONTAINER_ID" ]; then
    echo "🐳 Docker container found (api). Executing inside container..."
    docker compose exec -T api python src/scripts/reindex_vectors.py
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

    # Run the script with PYTHONPATH set to project root
    export PYTHONPATH=$PROJECT_ROOT
    $PYTHON_CMD apps/api/src/scripts/reindex_vectors.py
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Re-indexing completed successfully."
else
    echo "❌ Re-indexing failed."
    exit $EXIT_CODE
fi
