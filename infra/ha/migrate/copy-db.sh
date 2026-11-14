#!/bin/sh
# Copy prod's database into the HA cluster (docs/ha-preprod-plan.md §7).
# Needs: PROD_RO_URL (read-only role on prod), HA_ADMIN_URL (superuser URL via
# the HAProxy on an app VM, database `enzo`). Run on ha-data/app VM, not prod.
# Re-runnable: --clean replaces what a previous rehearsal left. Contains PII:
# the dump is mode 600 and deleted at the end (DUMP=... to choose where).
set -eu
: "${PROD_RO_URL:?}" "${HA_ADMIN_URL:?}"
DUMP="${DUMP:-/tmp/enzo.dump}"
START=$(date +%s)
umask 077
trap 'rm -f "$DUMP"' EXIT
pg_dump -Fc --no-owner -d "$PROD_RO_URL" -f "$DUMP"   # includes _prisma_migrations
pg_restore --no-owner --role=enzo --clean --if-exists --exit-on-error -d "$HA_ADMIN_URL" "$DUMP"
# The copy must reach nobody and show nothing live (plan §6).
psql "$HA_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM push_subscriptions" \
  -c "UPDATE site_settings SET status='coming_soon', launch_at=NULL"
echo "copy-db: $(( $(date +%s) - START )) s"
