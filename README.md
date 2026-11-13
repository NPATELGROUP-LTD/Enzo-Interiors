# Enzo Interiors — pre-prod branch

Only what the pre-prod stack builds: `apps/` (api, web, admin, portal), the two compose files and the env generator. Source of truth is `develop`; refresh this branch from it, do not develop here.

**Laptop / any machine with Docker**
```bash
node scripts/preprod-env.mjs [--host <LAN IP>]
docker compose --env-file .env.preprod -f docker-compose.preprod.yml up -d --build --wait
```
Web :13000, admin :15174, portal :15175, API :14000, Mailpit :18025. Mock data is seeded on start.

**Coolify** (Docker Compose, this branch, file `/docker-compose.coolify.yml`)
```bash
node scripts/preprod-env.mjs --coolify [--domain enzointeriors.co.uk]
```
Paste the generated `.env.coolify` into the resource's environment variables. Hosts: `preprod.`, `admin-preprod.`, `portal-preprod.`, `api-preprod.`, `media-preprod.`, `mail-preprod.` + domain.
