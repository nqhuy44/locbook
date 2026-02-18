#!/bin/bash
set -e

# Usage: ./tools/scripts/release.sh <target> <version>
# Example: 
#   ./tools/scripts/release.sh api v0.5.0       # API Only
#   ./tools/scripts/release.sh dashboard v0.5.0 # Dashboard Only
#   ./tools/scripts/release.sh admin v0.5.0     # Admin Only

TARGET=$1
VERSION=$2

if [ -z "$VERSION" ]; then
  echo "Error: Version argument required (e.g. v0.5.0)"
  exit 1
fi

echo "🚀 Preparing Release: $VERSION for target: $TARGET"

# Load .env variables for build-time injection (VITE_...)
if [ -f ".env" ]; then
  echo "📄 Loading .env file..."
  # Use a safer way to export variables from .env
  set -a
  source .env
  set +a
  echo "VITE_API_URL: $VITE_API_URL"
  echo "VITE_GOOGLE_CLIENT_ID: $VITE_GOOGLE_CLIENT_ID"
fi

# Portable sed -i function for macOS and Linux
portable_sed() {
  local pattern=$1
  local file=$2
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$pattern" "$file"
  else
    sed -i "$pattern" "$file"
  fi
}

update_api() {
  echo "📦 Updating API..."
  # Path fixed to src/core/config.py
  CONFIG_FILE="apps/api/src/core/config.py"
  if [ -f "$CONFIG_FILE" ]; then
    portable_sed "s/APP_VERSION: str = \".*\"/APP_VERSION: str = \"$VERSION\"/" "$CONFIG_FILE"
  fi
  echo "🐳 Building nqh44/spotary API..."
  nx run api:build-image --ver=$VERSION
  echo "🐳 Pushing nqh44/spotary API..."
  nx run api:push-image --ver=$VERSION
}

update_dashboard() {
  echo "📦 Updating Dashboard..."
  PKG_FILE="apps/dashboard/package.json"
  if [ -f "$PKG_FILE" ]; then
    portable_sed "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/spotary-dashboard..."
  nx run dashboard:prebuild-image
  nx run dashboard:build-image --ver=$VERSION
  nx run dashboard:postbuild-image
  echo "🐳 Pushing nqh44/spotary-dashboard..."
  nx run dashboard:push-image --ver=$VERSION
}

update_admin() {
  echo "📦 Updating Admin..."
  PKG_FILE="apps/admin/package.json"
  if [ -f "$PKG_FILE" ]; then
    portable_sed "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/spotary-admin..."
  nx run admin:prebuild-image
  nx run admin:build-image --ver=$VERSION
  nx run admin:postbuild-image
  echo "🐳 Pushing nqh44/spotary-admin..."
  nx run admin:push-image --ver=$VERSION
}

help() {
  echo "Usage: ./release.sh <target> <version>"
  echo "Example:"
  echo "  ./release.sh api v0.5.0"
}

case "$TARGET" in
  api)
    update_api
    ;;
  dashboard)
    update_dashboard
    ;;
  admin)
    update_admin
    ;;
  *)
    help
    ;;
esac

echo "🎉 Release $VERSION completed!"
