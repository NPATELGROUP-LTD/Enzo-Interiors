#!/bin/sh
# One private CA and one certificate per etcd/Patroni member, valid as server
# and client (etcd uses client certs; Patroni presents the same one).
# Run once on an admin machine:
#   DATA1_IP=.. DATA2_IP=.. WITNESS_IP=.. sh gen-certs.sh
# Output: out/<node>/{ca.crt,node.crt,node.key}. Copy each folder to its VM
# (CERT_DIR), keep out/ca.key offline. out/ is gitignored.
set -eu
: "${DATA1_IP:?}" "${DATA2_IP:?}" "${WITNESS_IP:?}"
cd "$(dirname "$0")"
mkdir -p out && cd out
[ -f ca.key ] || {
  openssl genrsa -out ca.key 4096
  openssl req -x509 -new -key ca.key -sha256 -days 1825 -subj "/CN=enzo-ha-ca" -out ca.crt
}
for pair in "ha-data-1:$DATA1_IP" "ha-data-2:$DATA2_IP" "ha-witness:$WITNESS_IP"; do
  name=${pair%%:*}; ip=${pair#*:}
  mkdir -p "$name"
  openssl genrsa -out "$name/node.key" 2048
  openssl req -new -key "$name/node.key" -subj "/CN=$name" -out "$name/node.csr"
  printf 'subjectAltName=IP:%s,IP:127.0.0.1,DNS:%s\nextendedKeyUsage=serverAuth,clientAuth\n' "$ip" "$name" > "$name/ext.cnf"
  openssl x509 -req -in "$name/node.csr" -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days 825 -sha256 -extfile "$name/ext.cnf" -out "$name/node.crt"
  cp ca.crt "$name/ca.crt"
  rm "$name/node.csr" "$name/ext.cnf"
done
echo "Done. On each VM: sudo chown root:999 <CERT_DIR>/node.key && sudo chmod 640 <CERT_DIR>/node.key (999 = the postgres user in the Patroni image)."
