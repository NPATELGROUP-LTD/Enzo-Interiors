# Shared Patroni settings. Per-node values (name, addresses, passwords, etcd
# hosts) come from PATRONI_* environment variables set in docker-compose.yml.
scope: enzo
namespace: /enzo/

etcd3:
  protocol: https
  cacert: /certs/ca.crt
  cert: /certs/node.crt
  key: /certs/node.key

restapi: {}
  # Bound to the node's private address by PATRONI_RESTAPI_LISTEN (compose). Plain
  # HTTP on the private link; HAProxy reads /primary. Unsafe calls need the REST login.

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    # Zero loss while both nodes are up; if the replica dies the primary keeps
    # writing instead of freezing (strict would freeze it).
    synchronous_mode: true
    synchronous_mode_strict: false
    postgresql:
      use_pg_rewind: true
      use_slots: true
      parameters:
        password_encryption: scram-sha-256
        wal_level: replica
        hot_standby: "on"
        wal_log_hints: "on"
        max_wal_senders: 10
        max_replication_slots: 10
        max_connections: 200
        synchronous_commit: "on"
        # Off until the off-site pgBackRest repo is chosen (README, "Backups").
        archive_mode: "off"
  initdb:
    - encoding: UTF8
    - data-checksums
  pg_hba:
    - local all all trust
    - host all all 127.0.0.1/32 scram-sha-256
    - host replication replicator __PRIVATE_CIDR__ scram-sha-256
    - host all all __PRIVATE_CIDR__ scram-sha-256
  post_bootstrap: /usr/local/bin/post_bootstrap.sh

postgresql:
  pg_hba:
    - local all all trust
    - host all all 127.0.0.1/32 scram-sha-256
    - host replication replicator __PRIVATE_CIDR__ scram-sha-256
    - host all all __PRIVATE_CIDR__ scram-sha-256

tags:
  nofailover: false
  noloadbalance: false
  clonefrom: false
  nosync: false
