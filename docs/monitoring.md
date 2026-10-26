# Monitoring and alerts

Who finds out, how, and what to do about it. Everything arrives by **email**, tagged in the
subject so a mail rule can sort it. Nothing here needs a server beyond the ones Enzo already runs.

## What watches what

| Watcher | Sees | Emails you when |
|---|---|---|
| **UptimeRobot** (outside, free) | The public site, `/booking`, the API, admin and portal from the internet | A page stops answering or its certificate is about to expire |
| **Coolify** | The server and containers | A deploy fails, a container stops or restarts, a backup or scheduled task fails, disk is nearly full |
| **The API** (`modules/alerts`, `modules/infra`) | Every request it serves | A 5xx, a customer email that could not be sent, Google Calendar needing a reconnect, a stuck newsletter, a lockout, a staff sign-in from a new country or device, staff or role changes, 10+ failed sign-ins from one address, 100+ refusals from one address |
| **The website, admin and portal** | Page and script errors | A server render error (website), a browser error (admin, portal) |
| **Daily summary** | The numbers below | 08:00 UK, every day. If it stops arriving, something is wrong |

UptimeRobot and Coolify run outside the app, so they still tell you when the whole platform is down.
The app cannot email you about its own death.

## The subject tags

| Tag | Means | Sorted to |
|---|---|---|
| `[Enzo][URGENT]` | Down, expiring, failed backup, disk | Inbox, notify |
| `[Enzo][ERROR]` | A fault in the app | A folder, look daily |
| `[Enzo][SECURITY]` | Sign-in and account events, attacks | Inbox, notify |
| `[Enzo][DAILY]` | The 08:00 summary | A folder |

Make one mail rule per tag in the mailbox that receives them. An alert carries the route, the status
and the first line of the error (addresses, tokens, ids and query strings are stripped), never a
request body, a person or a client.

**Noise control.** The same problem is emailed once every 15 minutes with a count of the repeats, and
each source stops at an hourly cap with one "limit reached" email. Everything is still recorded for
30 days in Settings › Alerts › Recent.

## Set it up (once)

1. **Coolify's shared environment** (one file for the whole Enzo stack):

   | Variable | Value |
   |---|---|
   | `ALERT_FROM` | `Enzo Alerts <alerts@mail.enzointeriors.co.uk>`. Empty sends from `MAIL_FROM` |
   | `ALERT_TO` | Comma-separated fallback, until someone saves recipients in Settings › Alerts. Use addresses **outside** the sending mailbox, so an alert still arrives if that mailbox is the problem |
   | `ALERT_SHARED_SECRET` | `openssl rand -base64 32`. One value, read by both `api` and `web` |
   | `TRUST_CLOUDFLARE` | `true` only if the API is reachable only through Cloudflare. Without it the access log has no country, so the new-country alert cannot fire |

   SMTP (`SMTP_HOST` and friends) is already set for customer mail; alerts reuse it. Zoho has to allow
   that login to send as the `alerts@` alias. If the test below is refused, leave `ALERT_FROM` empty
   until `alerts@` has its own mailbox.

2. **Make the first Infra manager** (see `docs/prelaunch.md`): invite them in Settings › Users, let them
   accept, then from the folder holding the compose file:

   ```bash
   docker compose run --rm --no-deps seed npm run auth:make-infra -- infra-person@example.com
   ```

3. **As the Infra manager**, open Settings › Alerts: add the recipients, then press each test button
   (Urgent, Error, Security) and **Send the daily summary now**. Check each lands in the right folder.

4. **Coolify notifications** (menu names differ by version): add an email destination, then switch on
   deployment failed, container stopped or restarting, backup failed, scheduled task failed and
   server disk usage. Leave deploy success off. Schedule database backups to the off-site MinIO and
   do one test restore.

5. **UptimeRobot**: one account, alert contact = the same outside addresses, 5-minute checks:

   - `https://www.enzointeriors.co.uk` and `/booking` as a keyword check for "Book a consultation"
   - `https://api.enzointeriors.co.uk/health`
   - `https://admin.enzointeriors.co.uk` and `https://portal.enzointeriors.co.uk`
   - one image from the media host

   Switch on certificate-expiry reminders if the plan offers them. Check what the free plan covers in
   its dashboard; this list is the intent, not a guarantee.

## Settings › Health

For the Infra manager only. Counts and sizes, never a client's content. A minute old at most;
storage sizes up to ten.

| Section | Reads | Worry when |
|---|---|---|
| Checks | Which switches are set (SMTP, recipients, `ALERT_SHARED_SECRET`, `TRUST_CLOUDFLARE`, push keys, Redis, `DISABLE_2FA`) | Any says Check |
| Database | Size, connections out of the maximum, response time, the biggest tables | Connections near the maximum; one table growing fast |
| File storage | Files and bytes in the images and documents buckets | Growth you cannot explain |
| Cache | Redis or memory, entries, how often a lookup was found | "Memory": Redis is down, so rate limits are per process |
| Last 24 hours | 5xx and refusals by hour, failed sign-ins, routes with most 5xx | A spike, or one route with all the errors |

Disk space on the server is not visible from the app. Coolify's disk alert covers it.

## When an email arrives

| Subject says | First look |
|---|---|
| An API route returned 500 | Settings › Alerts › Recent for the route and file:line, then the `api` log in Coolify |
| A page failed to render (website) | The `web` log. `DYNAMIC_SERVER_USAGE` means a page reads `searchParams` after an early return (CLAUDE.md, Site status) |
| An email could not be sent | SMTP login and Zoho's sending limits; customer mail is affected too |
| Calendar needs a reconnect | An Admin reconnects it in Settings › Booking schedule |
| A newsletter send has stopped | An Admin checks Settings › Newsletter; the API resumes from its cursor after a restart |
| N failed sign-ins from an address | Settings › Security › Refused. If it goes on, block the address in Cloudflare (WAF custom rule). The app never blocks by address, because many people share one |
| A staff sign-in from a new country or device | Ask them. If it was not them, reset their password and two-step sign-in (Settings › Users) |
| A staff account was invited, changed or removed | Settings › Security › Activity shows who |

## Cloudflare (Free plan)

Turn on **Bot Fight Mode**, and add one **rate-limit rule** on `/auth/*`. The app's own limits and the
alerts above are the main signal; the Free plan has no events feed worth reading here.

## Code scanning (GitHub Actions)

`.github/workflows/security.yml` runs on every pull request, every push to develop and main, and every
Monday. None of it is a required check: a red one is a reason to look.

- **audit (api, admin, web, portal):** `npm audit` for packages that ship. A new advisory can redden it
  with no code change.
- **secrets (gitleaks):** the whole git history. `.gitleaks.toml` allows the CI workflow's own
  throwaway keys by path, nothing else.
- **code (semgrep):** high-confidence rules only. Not verified against this codebase before it was
  added; if it is noisy, tune `--config` or add `--exclude`, do not switch it off.

Dependabot opens one pull request per app each Monday into `develop` (minor and patch together). It
reads `.github/dependabot.yml` from `main`, so it starts with the next release.

## Not covered

- **Browser errors on the public website.** Its server render errors are reported; client-side ones are not.
- **Traffic analytics.** Nothing counts visitors. That would need a privacy-friendly tool and a cookie decision.
- **A summary for Enzo's own admins.** The daily summary goes to whoever is in Settings › Alerts and
  holds no names or money, because the Infra manager never sees those.
- **The access log keeps IP addresses for 90 days.** The privacy text in `apps/admin` and `apps/portal`
  `lib/legal.ts` says so; change both together.

## Another client later

UptimeRobot, Coolify notifications and the Cloudflare rules work for any site. Error reporting, the
access log, Settings › Alerts, Health and the daily summary live in this repository only: another
NestJS app can copy `modules/alerts`, `modules/infra`, `core/alert.service.ts`, `core/access-log.service.ts`
and `data/{alert,access,infra}-store.ts`, with their migrations. Use a new `ALERT_SITE` so the subject
says which client it is.
