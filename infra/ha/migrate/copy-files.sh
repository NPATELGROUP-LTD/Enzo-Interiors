#!/bin/sh
# Mirror prod's two buckets to HA node 1; site replication carries them to
# node 2. Needs mc with aliases `prod` (read-only user) and `ha1`
# (infra/ha/data/setup-minio.sh makes ha1). Keys are kept, so the database
# needs no change. Safe to repeat: the second run only copies what changed.
set -eu
PUB="${PUB:-enzo-public}" PRIV="${PRIV:-enzo-private}"
START=$(date +%s)
for b in "$PUB" "$PRIV"; do
  mc mirror --preserve --overwrite "prod/$b" "ha1/$b"
done
echo "copy-files: $(( $(date +%s) - START )) s"
for b in "$PUB" "$PRIV"; do
  # Bucket must match prod -> ha1, then ha1 -> ha2 once replication caught up.
  [ -z "$(mc diff "prod/$b" "ha1/$b")" ] && echo "$b prod=ha1 ok" || { echo "$b prod!=ha1" >&2; exit 1; }
  [ -z "$(mc diff "ha1/$b" "ha2/$b")" ] && echo "$b ha1=ha2 ok" || { echo "$b ha1!=ha2 (replication still catching up?)" >&2; exit 1; }
done
