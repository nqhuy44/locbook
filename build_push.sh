#!/bin/bash

# Exit on error
set -e

# Check if tag argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./build_push.sh <tag>"
    echo "Example: ./build_push.sh v0.1.0"
    exit 1
fi

TAG=$1
IMAGE_NAME="nqh44/locbook"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"

echo "========================================"
echo "Building Docker image: $FULL_IMAGE_NAME"
echo "========================================"

# Build the image
docker build -t "$FULL_IMAGE_NAME" .

echo "========================================"
echo "Successfully built $FULL_IMAGE_NAME"
echo "========================================"

# Pushing logic (commented out for local testing if needed, but user asked for script TO push)
echo "Pushing image to Docker Hub..."
docker push "$FULL_IMAGE_NAME"

echo "========================================"
echo "Done! Image pushed: $FULL_IMAGE_NAME"
echo "========================================"
