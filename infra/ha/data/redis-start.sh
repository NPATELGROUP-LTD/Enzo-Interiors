#!/bin/sh
# First start writes the config; after that Sentinel/Redis rewrite it (CONFIG
# REWRITE) when roles change, so a restart never flips a node back by itself.
set -eu
: "${REDIS_PASSWORD:?}" "${NODE_IP:?}" "${REDIS_ROLE:?primary|replica}" "${DATA1_IP:?}"
CONF=/data/redis.conf
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<EOF
port 6379
bind 127.0.0.1 ${NODE_IP}
dir /data
requirepass ${REDIS_PASSWORD}
masterauth ${REDIS_PASSWORD}
replica-announce-ip ${NODE_IP}
save ""
appendonly no
maxmemory 128mb
maxmemory-policy volatile-ttl
EOF
  [ "$REDIS_ROLE" = replica ] && echo "replicaof ${DATA1_IP} 6379" >> "$CONF"
fi
exec redis-server "$CONF"
