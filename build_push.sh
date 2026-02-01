#!/bin/bash

# Exit on error
set -e

# Usage function
usage() {
    echo "Usage: ./build_push.sh <target> <tag>"
    echo "Targets:"
    echo "  be   - Build and push Backend (nqh44/locbook)"
    echo "  fe   - Build and push Frontend (nqh44/locbook-fe)"
    echo ""
    echo "Example: ./build_push.sh be v0.1.0"
    exit 1
}

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    usage
fi

TARGET=$1
TAG=$2

BE_IMAGE="nqh44/locbook:$TAG"
FE_IMAGE="nqh44/locbook-fe:$TAG"

build_be() {
    echo "========================================"
    echo "BACKEND: Building $BE_IMAGE..."
    echo "========================================"
    docker build -t "$BE_IMAGE" .
    
    echo "BACKEND: Pushing $BE_IMAGE..."
    docker push "$BE_IMAGE"
    echo "BACKEND: Done!"
}

build_fe() {
    echo "========================================"
    echo "FRONTEND: Building $FE_IMAGE..."
    echo "========================================"
    # Assuming dashboard dir is at ./dashboard
    docker build -t "$FE_IMAGE" ./dashboard
    
    echo "FRONTEND: Pushing $FE_IMAGE..."
    docker push "$FE_IMAGE"
    echo "FRONTEND: Done!"
}

# Main Logic
case "$TARGET" in
    be)
        build_be
        ;;
    fe)
        build_fe
        ;;
    *)
        echo "Error: Invalid target '$TARGET'"
        usage
        ;;
esac

echo "========================================"
echo "Build & Push Completed successfully!"
echo "========================================"
