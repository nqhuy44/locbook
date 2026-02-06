#!/bin/bash

# Exit on error
set -e

# Usage function
usage() {
    echo "Usage: ./build_push.sh <target> <tag>"
    echo "Targets:"
    echo "  be   - Build and push Backend (nqh44/locbook)"
    echo "  fe   - Build and push Frontend (nqh44/locbook-fe)"
    echo "  adm  - Build and push Admin (nqh44/locbook-admin)"
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

# Strip 'v' prefix from tag if present (e.g. v0.1.0 -> 0.1.0)
VERSION=${TAG#v}

BE_IMAGE="nqh44/locbook:$TAG"
FE_IMAGE="nqh44/locbook-fe:$TAG"
ADM_IMAGE="nqh44/locbook-adm:$TAG"

update_be_version() {
    echo "----------------------------------------"
    echo "Updating Backend version to $VERSION in source..."
    # Update src/config.py using sed
    # Matches: APP_VERSION: str = "..."
    sed -i "s/APP_VERSION: str = \".*\"/APP_VERSION: str = \"$VERSION\"/" src/config.py
    echo "Updated src/config.py"
}

update_fe_version() {
    echo "----------------------------------------"
    echo "Updating Frontend version to $VERSION in package.json..."
    cd dashboard
    npm version $VERSION --no-git-tag-version --allow-same-version
    
    # Generate version.json for dynamic checking
    echo "{\"version\": \"$VERSION\"}" > public/version.json
    
    cd ..
    echo "Updated dashboard/package.json & public/version.json"
}

update_adm_version() {
    echo "----------------------------------------"
    echo "Updating Admin version to $VERSION in package.json..."
    cd admin_dashboard
    npm version $VERSION --no-git-tag-version --allow-same-version
    
    # Generate version.json for dynamic checking
    echo "{\"version\": \"$VERSION\"}" > public/version.json
    
    cd ..
    echo "Updated admin_dashboard/package.json & public/version.json"
}

build_be() {
    update_be_version
    echo "========================================"
    echo "BACKEND: Building $BE_IMAGE..."
    echo "========================================"
    docker build -t "$BE_IMAGE" .
    
    echo "BACKEND: Pushing $BE_IMAGE..."
    docker push "$BE_IMAGE"
    echo "BACKEND: Done!"
}

build_fe() {
    update_fe_version
    echo "========================================"
    echo "FRONTEND: Building $FE_IMAGE..."
    echo "========================================"
    # Assuming dashboard dir is at ./dashboard
    docker build -t "$FE_IMAGE" ./dashboard
    
    echo "FRONTEND: Pushing $FE_IMAGE..."
    docker push "$FE_IMAGE"
    echo "FRONTEND: Done!"
}

build_adm() {
    update_adm_version
    echo "========================================"
    echo "ADMIN: Building $ADM_IMAGE..."
    echo "========================================"
    docker build -t "$ADM_IMAGE" ./admin_dashboard
    
    echo "ADMIN: Pushing $ADM_IMAGE..."
    docker push "$ADM_IMAGE"
    echo "ADMIN: Done!"
}

# Main Logic
case "$TARGET" in
    be)
        build_be
        ;;
    fe)
        build_fe
        ;;
    adm)
        build_adm
        ;;
    *)
        echo "Error: Invalid target '$TARGET'"
        usage
        ;;
esac

echo "========================================"
echo "Build & Push Completed successfully!"
echo "========================================"
