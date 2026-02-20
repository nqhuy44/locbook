#!/bin/bash
set -e

# 0. update tag version in docker-compose.yml
# BACKEND include api, bot, worker
BACKEND_VERSION="v1.0.4"
DASHBOARD_VERSION="v1.0.4"
ADMIN_VERSION="v1.0.4"

#replace all image tag in docker-compose.yml
# BACKEND include api, bot, worker
sed -i "s/image: nqh44\/spotary:.*$/image: nqh44\/spotary:$BACKEND_VERSION/g" docker-compose.yml
# DASHBOARD
sed -i "s/image: nqh44\/spotary-dashboard:.*$/image: nqh44\/spotary-dashboard:$DASHBOARD_VERSION/g" docker-compose.yml
# ADMIN
sed -i "s/image: nqh44\/spotary-admin:.*$/image: nqh44\/spotary-admin:$ADMIN_VERSION/g" docker-compose.yml

# 1. Pull api image
docker compose pull api

# 2. Run migration (Important: Run before restart app to let DB ready)
docker compose run --rm api alembic upgrade head

# 3. Restart service
if [ $? -ne 0 ]; then
    exit 1
fi
docker compose up -d

# 4. (Optional) Clean old images
docker image prune -f