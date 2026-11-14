#!/bin/sh
# Sentinel rewrites its own config, so it is written once. Quorum 2 of 3.
set -eu
: "${REDIS_PASSWORD:?}" "${NODE_IP:?}" "${DATA1_IP:?}"
CONF=/data/sentinel.conf
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<EOF
port 26379
bind 127.0.0.1 ${NODE_IP}
dir /data
sentinel announce-ip ${NODE_IP}
sentinel monitor enzo ${DATA1_IP} 6379 2
sentinel auth-pass enzo ${REDIS_PASSWORD}
sentinel down-after-milliseconds enzo 5000
sentinel failover-timeout enzo 30000
sentinel parallel-syncs enzo 1
EOF
fi
exec redis-sentinel "$CONF"
