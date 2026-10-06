# Pre-launch checklist

What has to happen outside the code before the site is switched to **Live** in
the admin (Settings → Website). Tick them off in order.

## Email

- [ ] Pick an SMTP provider (Postmark, Amazon SES, Resend, or the Google
      Workspace relay) and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
      `SMTP_USER`, `SMTP_PASS` in the root `.env`.
- [ ] Set `MAIL_FROM` to an address on the Enzo domain, e.g.
      `Enzo Interiors <no-reply@enzointeriors.co.uk>`.
- [ ] Add the provider's **SPF** and **DKIM** DNS records for that domain, and a
      **DMARC** record (`v=DMARC1; p=quarantine; rua=mailto:…`). Without these,
      reset links and enquiries land in spam.
- [ ] Set `COMPOSE_PROFILES=` (empty) in the production `.env`, so neither
      Mailpit nor the bundled PostgreSQL runs (see Database below).
- [ ] In the admin: Settings → Notifications, add the address(es) that should
      receive enquiries, then **Send test email**.

## Database

PostgreSQL runs in Docker in production too, but **as its own service, not
part of this app stack**, so deploying a new version of the apps never
recreates the database container or its volume.

- [ ] In Coolify, add a **PostgreSQL 16** database resource (Docker, with its
      own persistent volume). Do not publish its port to the internet.
- [ ] Put its internal connection URL in the app stack's `.env` as
      `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/enzo?schema=public`,
      and make sure the app stack can reach it on Coolify's network.
- [ ] Turn on the database's **scheduled backups** (daily at least) to an
      off-site S3 bucket, and do one **restore test** into a scratch database.
- [ ] Before every deploy that includes a new migration, take a manual backup
      first. The API applies migrations itself on start (`prisma migrate deploy`).

Keeping upgrades backward compatible is a rule for migrations, not for Docker:

- Migrations only move forward and are never edited once they have run.
- A release only **adds** (new tables, new nullable or defaulted columns).
  Renaming or dropping a column waits for a later release, once no running
  code reads it, so a rolled-back image still works against the newer schema.
- A PostgreSQL major upgrade (16 → 17) is a dump and restore into a new
  database, never a change of the image tag on the old volume.

## Addresses and proxy

- [ ] `WEB_PUBLIC_URL`, `ADMIN_URL`, `API_PUBLIC_URL` and `MEDIA_BASE_URL` are
      the real `https://` hostnames. The admin and web images are built against
      them, so rebuild after changing them.
- [ ] `TRUST_PROXY=2` behind Coolify + Cloudflare Tunnel, so rate limits and
      login lockouts see visitors' IPs rather than the proxy's.
- [ ] Cloudflare: cache the media hostname (the objects are sent with
      `Cache-Control: public, max-age=31536000, immutable`).

## Content

- [ ] Replace the 27 placeholder images. In the admin they are the images whose
      source is `unsplash` or `randomuser` (search "unsplash" in the image
      picker). The testimonial faces are stock photos next to real-sounding
      reviews; replace them or remove the photo.
- [ ] Company → address: fill in the street and postcode. It feeds the local
      business listing Google reads.
- [ ] Each page's **Metadata** section: check the title and description,
      and choose a share image if the generated card is not wanted.
- [ ] CMS → Book a consultation → Confirmation message: bookings are now
      confirmed instantly. A database imported before this release still has
      the old "request received, we'll confirm within one working day" text;
      change it to match (the shipped copy says "Your consultation is booked").

## Bookings

- [ ] Settings → Booking: set each day's first and last start time, breaks,
      consultation length, time between, the daily limit, how far ahead and
      the notice needed. The website offers exactly these times, minus what is
      already booked.
- [ ] Settings → Emails: the booking and enquiry emails go to these addresses;
      send the test email. Customers get their confirmation from `MAIL_FROM`.
- [ ] Make one test booking on the live site, check both emails arrive, then
      cancel it from Bookings (the customer gets the cancellation email).

## People

- [ ] Settings → Users: invite everyone who needs the admin. **Editor** can
      edit and send for review; **Admin** also publishes, takes bookings and
      changes settings. Keep at least two Admins so one can let the other back
      in. Invitation links last 7 days and can be resent.
- [ ] Read the privacy, terms and cookie pages against how the business
      actually operates (enquiry emails are now stored and emailed).

## Search

- [ ] Google Search Console: verify the domain (DNS, or put the HTML-tag code in
      `GOOGLE_SITE_VERIFICATION`), then submit `https://<site>/sitemap.xml`.
- [ ] Bing Webmaster Tools: import from Search Console.
- [ ] Google Business Profile for the studio, with the same name, phone and
      address as the site.
- [ ] After launch: validate a service page at https://validator.schema.org and
      run Lighthouse (SEO ≥ 95).

## Going live

- [ ] Settings → Website: either set an opening time (the site opens itself and
      the countdown reloads visitors' pages) or switch to **Live**.
- [ ] Change the first admin's password (profile menu → Account settings). The
      `ADMIN_PASSWORD` in `.env` is only used on the very first boot.
- [ ] Settings → Logo & icon: confirm both logos, and choose a favicon if the
      built-in one is not wanted.

## Google sign-in & Calendar

Optional: with no `GOOGLE_CLIENT_ID` the admin shows no Google sign-in and no
calendar card. Two-step sign-in needs only the first and last items.

- [ ] Migration `7_two_factor_google_calendar` is deployed (the API's
      `prisma migrate deploy` runs it; it only adds).
- [ ] `APP_ENCRYPTION_KEY` set: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
      Keep a copy outside the server; losing it means everyone re-enrols their
      authenticator app and the calendar is reconnected.
- [ ] Google Cloud project owned by NPATEL GROUP LTD (keep two NPATEL owners).
      APIs & Services → enable **Google Calendar API**; OAuth consent screen →
      **External**, scopes `openid`, `email`, `calendar.events`,
      `calendar.calendarlist.readonly`; Credentials → OAuth client, **Web
      application**, with both redirect URIs:
      `https://auth.enzo.client.npatelgroup.ltd/auth/google/callback` and
      `https://auth.enzo.client.npatelgroup.ltd/calendar/callback`.
- [ ] **Publish** the consent screen to production (Testing mode expires
      refresh tokens after 7 days and the calendar disconnects). The
      "unverified app" warning shown once is acceptable under 100 users.
      Verify `npatelgroup.ltd` in Search Console.
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_REDIRECT_URI`,
      `GOOGLE_CALENDAR_REDIRECT_URI` set to the production values above.
- [ ] Cloudflare Tunnel: public hostname `auth.enzo.client.npatelgroup.ltd` →
      Coolify's Traefik (same service as the API host). The compose file already
      adds the Host rule to the API router. If the hostname shows a certificate
      error, Universal SSL does not cover that depth: needs Advanced
      Certificate Manager.
- [ ] Server clock synced (authenticator codes fail otherwise):
      `timedatectl` shows "System clock synchronized: yes"; else
      `sudo timedatectl set-ntp true`.
- [ ] `TRUST_CLOUDFLARE=true`, **and** the API is reachable only through
      Cloudflare: no Coolify sslip.io or direct domain for the API (the header
      is otherwise forgeable and rate limits can be dodged).
- [ ] Settings › Booking schedule → connect the studio calendar and pick it;
      Account → link your own Google.
- Locked out of two-step sign-in: an Admin uses Settings › Users → Reset
  two-step sign-in; with no Admin, `docker compose run --rm seed npm run
  auth:reset-2fa -- <email>`. `DISABLE_2FA=true` turns it off for everyone (the
  API warns at boot); remove it afterwards.

## Rate limits

Three layers; each catches what the one below cannot.

1. **Cloudflare (the edge).** Floods and bots stop here, before the home
   server. In the Cloudflare dashboard for the domain:
   - [ ] Security → WAF → turn on the **Cloudflare Managed Ruleset** (free plans get the free managed rules).
   - [ ] Security → Bots → **Bot Fight Mode** on.
   - [ ] Security → WAF → **Rate limiting rules**: one rule, for requests whose
         path starts with `/auth/`, `/calendar`, `/booking`, `/enquiries` or `/newsletter`
         and method is `POST` — 20 requests per 10 seconds per IP → Block for
         10 minutes (as many rules as the plan allows; this one matters most).
   - [ ] Caching → Cache Rules: cache `/og/*` and `/_next/static/*` at the edge.
   - [ ] Cache Rule on the API host: cache `GET /booking/availability`,
         honouring the origin `Cache-Control` (`s-maxage=15`). Never cache
         `/auth`, `/appointments` or `/calendar`.
   - [ ] Keep **Under Attack Mode** in mind for a live attack (Overview page).
2. **The API** (`@nestjs/throttler`, counters in Redis): 300 requests a
   minute per IP overall, and tighter per route on every public write
   (sign-in, reset, enquiry, booking, newsletter). Sign-in also locks an
   address+IP pair progressively (5 failures → 1 min, 10 → 15 min, 15 → 1 h)
   and an address after 50 failures from anywhere (15 min; a password reset
   lifts it). Password-reset emails: 3 an hour per address. 429s carry
   `Retry-After` and a message the admin and website show as-is.
   - [ ] Run the `redis` service (in `docker-compose.yml`, or a Coolify Redis
         resource) and set `REDIS_URL` on the API. Without it limits still
         work, per process, and reset on restart.
   - [ ] `TRUST_PROXY` set to the number of proxies in front of the API
         (Cloudflare Tunnel → Coolify proxy = 2), or every visitor shares one
         limit — the proxy's.
3. **The forms**: a honeypot field on each public form. If spam still gets
   through, add Cloudflare Turnstile to the forms next.

