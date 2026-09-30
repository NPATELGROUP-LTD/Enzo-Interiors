# Deployment guide — dev, prod, Cloudflare Tunnel, Wix domain, real visitor IP

Sections 1–2 are the two environments. 3 is production from scratch. 4 is the
Wix/Cloudflare problem. 5 is the visitor IP. 6 is updates and rollback.

## 1. Environments at a glance

| | Dev (your PC) | Prod (your server) |
|---|---|---|
| Runs | Docker: everything, or Postgres+MinIO with host dev servers | Docker via Coolify |
| Postgres | bundled, `COMPOSE_PROFILES=dev,db` | separate Coolify database resource, `DATABASE_URL` set |
| MinIO | bundled | bundled in the stack (own volume) |
| Mail | Mailpit at http://localhost:8025 | real SMTP (Postmark / SES / Resend) |
| URLs | localhost | your real domains via the tunnel |
| `.env` | local, never committed | set in Coolify's Environment tab |

Never share secrets between the two: generate separate `JWT_SECRET`,
`REVALIDATE_SECRET`, `S3_*` and `ADMIN_PASSWORD` for prod.

## 2. Development

```bash
cp .env.example .env
# fill in: POSTGRES_PASSWORD, JWT_SECRET, ADMIN_*, REVALIDATE_SECRET, S3_*
# keep COMPOSE_PROFILES=dev,db and DATABASE_URL empty
docker compose up -d --build --wait
docker compose run --rm seed
```

Admin at http://localhost:5174, site at http://localhost:3000. For hot reload,
start only the backing services and run the apps on the host:

```bash
docker compose up -d --wait postgres minio minio-init
```

`docker compose down --volumes` wipes the database and uploads.

## 3. Production from scratch

### 3.1 Server
1. Ubuntu 22.04/24.04 VM (Proxmox is fine). 4 GB RAM / 2 vCPU / 40 GB disk minimum.
2. Install Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
3. Firewall: allow SSH (ideally from your IP only) and nothing else inbound.
   With a tunnel you do **not** open 80/443. Coolify's own UI on :8000 should be
   reachable only from your LAN/VPN.

### 3.2 Database (separate from the app)
1. Coolify → Project → **New Resource → Database → PostgreSQL 16**.
2. Set name, user, password, database `enzo`. Leave "publicly available" **off**.
3. Attach it to the same Docker network as the app (or use the internal URL
   Coolify shows). Copy the **internal** connection string.
4. Enable scheduled backups **to S3** (Backblaze B2 / R2 / any S3). Daily, keep 14+.
5. Do a restore test into a scratch database before launch.

### 3.3 App stack
1. Coolify → New Resource → Docker Compose → point at the git repo, `docker-compose.yml`.
2. Environment variables (Coolify UI):

```
COMPOSE_PROFILES=                 # empty: no bundled postgres, no mailpit
DATABASE_URL=postgresql://USER:PASS@<coolify-db-host>:5432/enzo?schema=public
JWT_SECRET=<openssl rand -base64 48>
REVALIDATE_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=you@yourdomain
ADMIN_PASSWORD=<12+ chars, change after first login>
ADMIN_NAME=Your Name
S3_ACCESS_KEY_ID=<random>
S3_SECRET_ACCESS_KEY=<random>
MEDIA_BASE_URL=https://media.yourdomain.com/enzo-public
WEB_PUBLIC_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
API_PUBLIC_URL=https://api.yourdomain.com
TRUST_PROXY=1                     # see section 5
SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... MAIL_FROM="Enzo Interiors <no-reply@yourdomain.com>"
```

   The admin and web images bake the public URLs in at build time, so set
   them **before** the first deploy, and rebuild if they change.
3. Deploy. Migrations run when the API boots.
4. First-time content import (once): `docker compose run --rm seed` (Coolify
   terminal on the stack, or SSH).
5. Log in to admin, change the admin password, set logos in Settings, fill the
   booking rules, and update "Confirmation message" in CMS › Book a consultation.
6. Mail DNS: add SPF, DKIM, DMARC for the `MAIL_FROM` domain (docs/prelaunch.md).

### 3.4 Four public hostnames
| Hostname | Points to |
|---|---|
| `yourdomain.com` (+ `www`) | web :3000 |
| `admin.yourdomain.com` | admin :80 |
| `api.yourdomain.com` | api :4000 |
| `media.yourdomain.com` | minio :9000 |

### 3.5 Cloudflare Tunnel
1. Cloudflare Zero Trust → Networks → Tunnels → Create → copy the token.
2. Run `cloudflared` on the server (Coolify service or `docker run cloudflare/cloudflared tunnel run --token ...`).
3. Public hostnames map to the table above. Service URL is the container
   address on the Docker network (`http://web:3000` if cloudflared shares the
   network) or `http://<host-ip>:<port>`.
4. Put Cloudflare Access in front of `admin.` if you want a second lock.

## 4. The Wix domain problem

A tunnel hostname is a Cloudflare-proxied CNAME, and that only works if
Cloudflare answers DNS for the domain. Wix DNS cannot point a name at a tunnel
(`<id>.cfargotunnel.com` does not resolve publicly for outside zones). So
Cloudflare has to host the DNS. Options, best first:

**A. Change nameservers (free, keeps Wix as registrar).**
Wix: Domains → your domain → ⋯ → *Advanced* → *Nameservers* → set the two
Cloudflare nameservers. Wix allows this for domains bought through Wix; I have
not verified it for your specific domain, so check that the option appears.
Before switching: in Cloudflare add the site, let it import records, and
recreate anything Wix hosted (email MX, Wix site records if you still use Wix
for anything) so nothing breaks.

**B. Transfer the domain to Cloudflare Registrar.**
Wix requires the domain to be older than 60 days and unlocked; you get an auth
code by email. At-cost pricing, DNS is automatically on Cloudflare. Cleanest
long term.

**C. Keep Wix DNS, no tunnel.**
Add an A record at Wix to your server's public IP, open 80/443, let Coolify's
Traefik issue Let's Encrypt certificates. You lose tunnel hiding and DDoS
protection, and your home/office IP is public.

**D. Partial (CNAME) setup.** Cloudflare offers this only on the Business plan
(~$200/mo). Not worth it here.

Not recommended: a separate cheap domain for the tunnel with Wix redirecting to
it. Redirects are visible to users and hurt SEO.

**Recommendation:** try A; if Wix greys it out, do B. Tell me which one you get
and I'll adjust the steps.

After DNS is on Cloudflare: SSL/TLS mode **Full**, and add the four hostnames
in the tunnel. Lower TTL before switching, and do it off-hours.

## 5. Passing the real visitor IP

Chain: visitor → Cloudflare edge → cloudflared → (Traefik) → container.
Cloudflare adds `CF-Connecting-IP` and `X-Forwarded-For` with the visitor IP.

The API uses `app.set('trust proxy', TRUST_PROXY)` (apps/api/src/main.ts:24), so
`req.ip` is right only if the hop count is right:

- **cloudflared → container directly** (no Traefik): `TRUST_PROXY=1`.
- **cloudflared → Traefik → container**: `TRUST_PROXY=2`, **and** Traefik must be
  told to trust cloudflared, otherwise it discards the incoming
  `X-Forwarded-For` and every visitor looks like cloudflared's address. In
  Coolify's proxy config (Servers → Proxy) add to the `https`/`http`
  entrypoint: `--entryPoints.http.forwardedHeaders.trustedIPs=<docker subnet of cloudflared>`
  (and the same for `https`).

The `.env.example` note says 2 for Coolify + Tunnel; that is only true for the
Traefik path. Pick the one matching your routing.

**Verify, don't assume:** submit a form from your phone on mobile data and check
the stored/logged IP is your carrier's, not `172.x` or a Cloudflare range. If
wrong, change the hop count by one.

**Do not let the origin be reached directly.** Trusting forwarded headers is
only safe if all traffic arrives through the tunnel. Keep 80/443 and the
published container ports closed to the outside, so nobody can send a forged
`X-Forwarded-For`. The compose file publishes `API_PORT`, `WEB_PORT`,
`ADMIN_PORT`, `MINIO_PORT` on all interfaces; in production either bind them to
`127.0.0.1` or block them at the firewall.

The Next.js site sees the header too. Anything that needs the IP on the web
side (analytics, forms) should read `x-forwarded-for` (first entry) or
`cf-connecting-ip`.

## 6. Updates, backups, rollback

- **Deploy:** push to `main`, Coolify redeploys the stack. The database is not
  part of it, so data is untouched. See "Deploy trigger" below.
- **Before a migration:** take a manual backup in the Coolify database resource.
- **Migrations are additive only** (docs/prelaunch.md), so rolling back the app
  to the previous build still works against the new schema. Rename/drop only in
  a later release once nothing reads the old shape.
- **Postgres major upgrade:** dump and restore into a new resource; do not swap
  the image tag on the same volume.
- **Uploads:** MinIO volume `minio-data` is not covered by the DB backup. Back it
  up too (`mc mirror` to S3, or snapshot the volume).
- **Disaster recovery drill:** every few months restore the latest backup to a
  scratch DB and open the admin against it.

### Deploy trigger (GitHub → Coolify)

The stack uses the GitHub App source `npg-github-source`, so the deploy is
triggered by that App's webhook, not by a repo webhook and not by
`/api/v1/deploy` (that endpoint needs a Bearer token, which GitHub cannot send;
it answers `{"message":"Unauthenticated."}`).

- **GitHub App webhook:** active, content type `application/json`, subscribed to
  Push, URL and secret exactly as shown on Coolify → Sources → `npg-github-source`.
  A secret mismatch fails the signature check.
- **Coolify host is behind Cloudflare Access.** GitHub must reach the webhook
  path only: keep the UI protected and give `/webhooks/*` a Bypass policy.
- **Resource:** Auto Deploy on, branch `main`.
- **Verify after any change:** GitHub App → Advanced → Recent Deliveries →
  Redeliver a `push`. Expect 200 and a new entry under Coolify → Deployments.
  A 200 from the site alone proves nothing: the old deployment keeps serving.

## Launch checklist
- [ ] DNS on Cloudflare, four tunnel hostnames green
- [ ] `COMPOSE_PROFILES` empty, `DATABASE_URL` external
- [ ] Secrets are prod-only; admin password changed
- [ ] Backups run, one restore tested; MinIO backed up
- [ ] SMTP works, SPF/DKIM/DMARC set, test booking emails arrive
- [ ] Visitor IP verified from mobile data
- [ ] Origin ports closed to the outside
