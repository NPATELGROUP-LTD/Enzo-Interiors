# Migration rehearsal (plan §7)

Run twice. Run 1 finds problems. Run 2 is timed: the minutes printed by
`copy-db.sh` and `copy-files.sh`, plus the checks below, plus a margin, are the
production maintenance window.

Prod access is a **read-only Postgres role** and a **read-only MinIO user**,
made for the copy and deleted at teardown (plan §10). Never use prod's owner
credentials. The dump goes node to node, never through a third party.

Before: prod backup test-restored; `patronictl list` healthy; MinIO
`mc admin replicate status ha1` OK; `APP_ENCRYPTION_KEY` on HA = prod's value.

1. `sh copy-db.sh`   (dump, restore with `_prisma_migrations`, empty push subscriptions, site set to coming soon)
2. `sh copy-files.sh` (mirror both buckets, then `mc diff` prod to ha1 and ha1 to ha2)
3. `sh check.sh`      (row counts per table)
4. On an app VM: `npx prisma migrate status` shows nothing pending.
5. By hand, write each down: staff sign-in with password and authenticator code
   (proves the key), client portal sign-in, open a document / invoice PDF / CMS
   image / the site, a chat between a user on node 1 and one on node 2, and
   Mailpit holds only what should have been sent.

Timed run: stop the HA API, repeat 1 to 3, start, repeat 4 and 5. Record minutes.
