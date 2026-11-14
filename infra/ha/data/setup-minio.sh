#!/bin/sh
# Run once, from any machine that can reach both MinIOs, while they are empty.
# Creates the two buckets, links the nodes with site replication, then adds
# the app's service user (created after linking so it replicates to both).
# Needs `mc`. Env: DATA1_IP DATA2_IP MINIO1_ROOT_USER MINIO1_ROOT_PASSWORD
# MINIO2_ROOT_USER MINIO2_ROOT_PASSWORD APP_S3_KEY APP_S3_SECRET
# [S3_PUBLIC_BUCKET S3_PRIVATE_BUCKET]
set -eu
PUB=${S3_PUBLIC_BUCKET:-enzo-public}; PRIV=${S3_PRIVATE_BUCKET:-enzo-private}
mc alias set ha1 "http://${DATA1_IP}:9000" "$MINIO1_ROOT_USER" "$MINIO1_ROOT_PASSWORD"
mc alias set ha2 "http://${DATA2_IP}:9000" "$MINIO2_ROOT_USER" "$MINIO2_ROOT_PASSWORD"
mc mb --ignore-existing "ha1/$PUB" "ha1/$PRIV"
mc anonymous set download "ha1/$PUB"
mc admin replicate add ha1 ha2
mc admin user add ha1 "$APP_S3_KEY" "$APP_S3_SECRET"
mc admin policy attach ha1 readwrite --user "$APP_S3_KEY"
mc admin replicate info ha1
echo "Check: mc admin replicate status ha1 ; then upload to ha1 and list on ha2."
