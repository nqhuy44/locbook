#!/bin/bash
set -e

# Usage: ./tools/scripts/release.sh <version> [target]
# Example: 
#   ./tools/scripts/release.sh v0.5.0           # All
#   ./tools/scripts/release.sh api v0.5.0       # API Only
#   ./tools/scripts/release.sh dashboard v0.5.0 # Dashboard Only
#   ./tools/scripts/release.sh admin v0.5.0     # Admin Only

TARGET=$1
VERSION=$2

if [ -z "$VERSION" ]; then
  echo "Error: Version argument required (e.g. v0.5.0)"
  exit 1
fi

echo "🚀 Preparing Release: $VERSION for target: ${TARGET:-ALL}"

update_api() {
  echo "📦 Updating API..."
  CONFIG_FILE="apps/api/src/config.py"
  if [ -f "$CONFIG_FILE" ]; then
    sed -i "s/APP_VERSION: str = \".*\"/APP_VERSION: str = \"$VERSION\"/" "$CONFIG_FILE"
  fi
  echo "🐳 Building nqh44/locbook API..."
  nx run api:build-image --ver=$VERSION
}

update_dashboard() {
  echo "📦 Updating Dashboard..."
  PKG_FILE="apps/dashboard/package.json"
  if [ -f "$PKG_FILE" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/locbook-dashboard..."
  nx run dashboard:build-image --ver=$VERSION
}

update_admin() {
  echo "📦 Updating Admin..."
  PKG_FILE="apps/admin/package.json"
  if [ -f "$PKG_FILE" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/locbook-admin..."
  nx run admin:build-image --ver=$VERSION
}

help() {
  echo "Usage: ./release.sh <version> [target]"
  echo "Example:"
  echo "  ./release.sh api v0.5.0       # API Only"
  echo "  ./release.sh dashboard v0.5.0 # Dashboard Only"
  echo "  ./release.sh admin v0.5.0     # Admin Only"
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
