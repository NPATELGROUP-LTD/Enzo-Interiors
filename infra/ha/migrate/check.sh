#!/bin/sh
# Exact row count of every table, prod vs HA. Rows prod gained since the dump
# are the only acceptable differences (rehearsal: prod is not paused).
# Needs PROD_RO_URL and HA_ADMIN_URL.
set -eu
: "${PROD_RO_URL:?}" "${HA_ADMIN_URL:?}"
Q="SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
psql "$PROD_RO_URL" -At -F' ' -c "$Q" > "$T/prod"
psql "$HA_ADMIN_URL" -At -F' ' -c "$Q" > "$T/ha"
# push_subscriptions is deliberately emptied on the copy, so it is left out.
grep -v "^push_subscriptions " "$T/prod" > "$T/p"; grep -v "^push_subscriptions " "$T/ha" > "$T/h"
diff "$T/p" "$T/h" > "$T/d" || { echo "DIFFERENT (prod -, ha +):"; cat "$T/d"; exit 1; }
echo "row counts equal across $(wc -l < "$T/p") tables"
