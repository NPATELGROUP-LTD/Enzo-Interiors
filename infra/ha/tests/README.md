# HA break tests (Phase 5)

Plan: `docs/ha-preprod-plan.md` section 8. Run T1 to T14 in order, after `../migrate` has passed. Write every result in the table at the bottom.

## Setup, once

On a machine **outside** the cluster (your laptop is fine): `probe-http.sh` and `probe-data.sh` (needs `psql`). Create database `ha_probe` on the primary, then `PROBE_URL=postgresql://.../ha_probe sh probe-data.sh init`. The URL points at an app VM's HAProxy (port 5432), the same path the app uses.

On a data VM, in `infra/ha/data`, define these once per shell:
```sh
pl() { docker compose exec patroni patronictl -c /tmp/patroni.yml list; }   # who is leader
```

## Around every test
```sh
sh probe-http.sh https://ha-api.<domain>/health > http.log &     # availability
sh probe-data.sh run > acked.log &                               # writes
# ... do the test, wait for green ...
kill %1 %2
sh probe-http.sh --summary http.log      # failed + longest outage in seconds
sh probe-data.sh verify acked.log        # must print missing=0
pl                                       # exactly one Leader, no second one
```
Start each test from green: `pl` shows Leader + Sync Standby, Sentinel names a master (`redis-cli -p 26379 sentinel master enzo`), `mc admin replicate status ha1` healthy, both app VMs answering.

## Tests

| # | Do | Pass |
|---|---|---|
| T1 | Stop VM `ha-app-2` | outage under 30 s |
| T2 | Stop VM `ha-app-1` (data VMs stay) | under 30 s |
| T3 | On data-2: `docker compose stop patroni` | 0 failed, missing=0; primary keeps writing |
| T4 | On data-1 (primary): `docker compose stop patroni` | under 60 s, missing=0 (**G2**) |
| T5 | On data-1: `docker compose start patroni` | rejoins as replica, becomes Sync Standby |
| T6 | Power off **node 2** (app-2 + data-2) | under 60 s, missing=0 (**G1**) |
| T7 | Power off **node 1** (app-1, data-1, witness) | recovered by the runbook below in under 30 min, missing=0 (**G3**) |
| T8 | On node 2, drop traffic to node 1's data VMs and witness (`iptables -I OUTPUT -d <ip> -j DROP`, remove after) | one Leader only, node 2 refuses writes (**G4**) |
| T9 | While uploading documents in a loop: `docker compose stop minio` on data-1 | uploads and downloads still work; after start `mc diff ha1/<b> ha2/<b>` is empty; note any object lost |
| T10 | Stop Redis on the master (`docker compose stop redis`) | Sentinel promotes under 30 s; rate limits and chat continue |
| T11 | Push a new `ha-preprod` build: Coolify deploys app-1, wait for healthy, then app-2 | 0 failed (**G5**) |
| T12 | Restore a backup plus bucket copy into an empty VM; boot the app; run the `../migrate` checks | works; record minutes (**G7**). Needs pgBackRest, which is not configured yet (`../README.md`), so until then this is a `pg_dump` restore only |
| T13 | Leave everything running 24 h across 08:00 | exactly one `[DAILY]` mail in Mailpit; no duplicate alerts beyond the known up-to-2x |
| T14 | Reboot each VM one at a time | cluster returns to green with no manual step |

T9 and T12 are the two where the plan expects possible loss or a gap. Record what you see, do not tidy it.

## T7 runbook: node 1 is gone

Write down the start time. Node 2 has one etcd member of three, so etcd and Patroni there will not elect a leader.

1. **Confirm** node 1 is really off (console), not just unreachable. If it is only unreachable, this is T8 and you must not continue: forcing a new cluster here while node 1 is alive makes two primaries.
2. On data-2 stop everything that writes: `docker compose stop patroni`. Also stop both app stacks' `api` if app-2 is still up, so nothing writes mid-change.
3. **Make etcd a one-member cluster.** Back up the volume first (`docker run --rm -v <etcd-data volume>:/d -v $PWD:/b alpine tar czf /b/etcd-backup.tgz /d`). Then restart etcd with `--force-new-cluster` (add it to the etcd command in `../data/docker-compose.yml` temporarily, `docker compose up -d etcd`). Confirm with `etcdctl endpoint health`. **Check this flag and the member-removal steps against the etcd version in use before the test; this runbook is the first draft.**
4. `docker compose up -d patroni`. With a one-member etcd it takes the leader key. `pl` must show data-2 as Leader. Postgres comes up on the last state it had, which includes every acknowledged write because it was the synchronous standby.
5. Sentinel and Redis: `docker compose up -d redis sentinel` on data-2; `redis-cli -p 26379 sentinel master enzo` should name data-2 (if it names the dead address run `sentinel failover enzo`).
6. MinIO on data-2 serves alone. Site replication to the dead node stays pending, which is fine.
7. Point check: app-2 `/health` returns 200 through the tunnel; log in; open a document.
8. Stop the clock. Record minutes and what was awkward. Fix this runbook before the second run.
9. **Rebuild node 1** (new VMs, certs, `../README.md` bring-up), add its etcd member back (`etcdctl member add`), start Patroni as a replica, then remove `--force-new-cluster` from the compose file.

## Results

| # | Date | Failed requests | Longest outage s | missing | Leaders | Notes | Pass |
|---|---|---|---|---|---|---|---|
