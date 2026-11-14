#!/bin/sh
# Availability probe (plan 8.1). Run on a machine OUTSIDE the cluster for the
# whole test:  sh probe-http.sh https://ha-api.<domain>/health > http.log
# Then:        sh probe-http.sh --summary http.log
# /health runs SELECT 1, so a 200 means the API and a database primary answered.
set -u
if [ "${1:-}" = "--summary" ]; then
  awk '{ if ($2 != 200) { bad++; if (!run) start=$1; run++; if (run>longest) longest=run } else run=0; n++ }
       END { printf "requests=%d failed=%d longest_outage_s=%d\n", n, bad+0, longest+0 }' "$2"
  exit 0
fi
URL="${1:?url}"
while :; do
  printf '%s %s\n' "$(date +%s)" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$URL" || true)"
  sleep 1
done
