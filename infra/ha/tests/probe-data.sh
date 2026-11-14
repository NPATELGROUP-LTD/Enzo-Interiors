#!/bin/sh
# Data-loss probe (plan 8.1). Needs PROBE_URL = a psql URL to database ha_probe
# through an app VM's HAProxy (port 5432), not the app schema.
#   sh probe-data.sh init              create the table once
#   sh probe-data.sh run > acked.log   insert 5/s, log each id the database acknowledged
#   sh probe-data.sh verify acked.log  every acknowledged id must exist
set -u
: "${PROBE_URL:?}"
case "${1:-}" in
  init) psql "$PROBE_URL" -v ON_ERROR_STOP=1 -c "create table if not exists probe(id serial primary key, at timestamptz default now())" ;;
  run)  while :; do
          id=$(psql "$PROBE_URL" -At -c "insert into probe default values returning id" 2>/dev/null | head -n1)
          [ -n "$id" ] && echo "$id"   # printed only after the commit was acknowledged
          sleep 0.2
        done ;;
  verify)
    psql "$PROBE_URL" -At -c "select id from probe order by id" | sort > /tmp/probe.have
    sort "$2" > /tmp/probe.acked
    missing=$(comm -23 /tmp/probe.acked /tmp/probe.have | wc -l)
    echo "acknowledged=$(wc -l < /tmp/probe.acked) missing=$missing"
    [ "$missing" -eq 0 ] || { echo "FAIL: acknowledged writes lost (RPO > 0)"; exit 1; } ;;
  *) echo "usage: init | run | verify <file>"; exit 2 ;;
esac
