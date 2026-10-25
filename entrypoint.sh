#!/bin/sh
set -e

# Create (or update) the superuser if credentials are provided
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
    echo "Ensuring superuser $PB_ADMIN_EMAIL exists..."
    /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"
else
    echo "PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not set, skipping superuser creation."
fi

# Generate the runtime config the frontend reads from window.__ENV__
cat > /pb/pb_public/env-config.js <<EOF
window.__ENV__ = {
  VITE_DISABLE_SIGNUPS: "${VITE_DISABLE_SIGNUPS:-false}"
};
EOF

# Hand over to PocketBase (or whatever command was passed)
exec "$@"