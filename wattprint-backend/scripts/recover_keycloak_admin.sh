#!/usr/bin/env bash
# Run once on the backend host from wattprint-backend after a lost master-realm admin password.
# Uses KEYCLOAK_ADMIN_PASSWORD from the existing .env without printing it or replacing database data.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker compose ps --services --status running | grep -qx keycloak-db; then
  echo "Keycloak database is not running; start keycloak-db first." >&2
  exit 1
fi

echo "Stopping Keycloak before the recovery command..."
docker compose stop keycloak

echo "Creating the temporary master-realm admin 'detectricity-recovery'..."
if ! docker compose run --rm --no-deps keycloak \
  bootstrap-admin user --username detectricity-recovery \
  --password:env KC_BOOTSTRAP_ADMIN_PASSWORD --no-prompt; then
  echo "Recovery failed. The Keycloak database was left intact." >&2
  docker compose up -d keycloak
  exit 1
fi

echo "Starting Keycloak again..."
docker compose up -d keycloak
echo "Recovery admin is ready. Continue setup through the forwarded Keycloak port."
