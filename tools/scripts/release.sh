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

update_api() {
  echo "📦 Updating API..."
  # Path fixed to src/core/config.py
  CONFIG_FILE="apps/api/src/core/config.py"
  if [ -f "$CONFIG_FILE" ]; then
    # GNU sed style
    sed -i "s/APP_VERSION: str = \".*\"/APP_VERSION: str = \"$VERSION\"/" "$CONFIG_FILE"
  fi
  echo "🐳 Building nqh44/spotary API..."
  nx run api:build-image --ver=$VERSION
}

update_dashboard() {
  echo "📦 Updating Dashboard..."
  PKG_FILE="apps/dashboard/package.json"
  if [ -f "$PKG_FILE" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/spotary-dashboard..."
  nx run dashboard:build-image --ver=$VERSION
}

update_admin() {
  echo "📦 Updating Admin..."
  PKG_FILE="apps/admin/package.json"
  if [ -f "$PKG_FILE" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "$PKG_FILE"
  fi
  echo "🐳 Building nqh44/spotary-admin..."
  nx run admin:build-image --ver=$VERSION
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
