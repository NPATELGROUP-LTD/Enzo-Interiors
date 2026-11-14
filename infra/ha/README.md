# HA data stack (Phase 2)

The data side of the HA pre-prod (plan: `docs/ha-preprod-plan.md`). Nothing here
runs in production yet. Three machines on a private link (VLAN or WireGuard):
`ha-data-1`, `ha-data-2`, `ha-witness`. App VMs run `haproxy.cfg` (Phase 3).

| Where | Runs |
|---|---|
| ha-data-1, ha-data-2 | etcd, Postgres+Patroni, Redis, Sentinel, MinIO |
| ha-witness | etcd, Sentinel (the tie-break vote; on node 1 for now, VPS before prod) |

## Bring-up

1. **Firewall first.** On every VM allow 2379, 2380, 5432, 8008, 6379, 26379, 9000 from `PRIVATE_CIDR` only. Nothing public.
2. **Certificates** (admin machine): `DATA1_IP=.. DATA2_IP=.. WITNESS_IP=.. sh certs/gen-certs.sh`. Copy `certs/out/<node>/` to that VM's `CERT_DIR`; run the `chown`/`chmod` it prints. Keep `ca.key` offline.
3. **Env:** `cp data/.env.example data/.env`, fill in, `openssl rand -hex 24` for each secret.
4. **Start etcd on all three first:** `docker compose --profile data up -d etcd` (witness: `--profile witness`). Check `etcdctl --endpoints=... --cacert --cert --key endpoint health`.
5. **ha-data-1:** `docker compose --profile data up -d --build`. Wait until `docker exec <patroni> patronictl -c /tmp/patroni.yml list` shows a Leader.
6. **ha-data-2** (`REDIS_ROLE=replica`): same command. It clones from the leader and shows `Sync Standby`.
7. **Witness:** `docker compose --profile witness up -d`.
8. **MinIO:** `sh data/setup-minio.sh` (see its header).
9. **Gate (plan P2):** Patroni shows Leader + Sync Standby; `redis-cli -p 26379 sentinel master enzo` names the master; `mc admin replicate status` is healthy; a file uploaded to one MinIO is listed on the other.

## Facts that matter

- Postgres is 16, like production. Restores into it use `pg_restore --no-owner --role=enzo` (the app role is created at bootstrap; production's role names differ). Include `_prisma_migrations` in the dump or `migrate deploy` re-runs old migrations.
- `synchronous_mode_strict` is off: zero loss while both nodes are up; if the replica dies the primary keeps writing.
- Losing ha-data-1 while the witness shares its host loses 2 of 3 etcd votes: recovery is manual (plan T7) until the witness moves to a VPS (add the new etcd member, remove the old).
- App connects to `haproxy` for Postgres, Redis and MinIO; the app's S3 key is the replicated service user, not MinIO root.

## Not done yet (deliberate)

- **Backups:** `archive_mode` is off and pgBackRest is installed but unconfigured. It needs the off-site repo (UK/EU; add the provider to `lib/legal.ts`). Until then use `pg_dump` for rehearsal only.
- **TLS on Redis, MinIO and Postgres traffic:** the private link (WireGuard or isolated VLAN) is the protection; etcd has TLS with client certs. Add TLS to the rest if the link is not encrypted.
- **Image pins:** `postgres:16` and the PGDG `patroni` package are unpinned; pin the versions that pass the break tests.
- MinIO image is the same `bitnamilegacy` release as production; its licence/support status is an open item.
