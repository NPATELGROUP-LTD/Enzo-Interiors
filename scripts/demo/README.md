# Local demo

Runs the whole platform on one Windows machine, with mock data, for showing it to a client.

```
scripts\demo\demo.cmd            build + start + load mock data + print the sign-ins and URLs
scripts\demo\demo.cmd info       print them again
scripts\demo\demo.cmd stop       stop, keep the data
scripts\demo\demo.cmd reset      WIPE the demo database, uploads and settings (asks you to type "wipe")
```

You need Docker Desktop running. The first start builds four images and takes several minutes; later starts are fast.

## Which code it shows

It builds whatever is checked out, so use `develop` once the redesign PRs are merged (shell, dashboard, CMS and clients already are; Projects is PR #158). Until then, on a throw-away local branch:

```
git switch -c demo origin/develop
git merge origin/claude/projects-redesign-5fd616     # PR #158; never push this branch
```

The public quote maker (`/quote`) is PR #141 and is not in `develop`; merge `origin/feature/quote-maker-web` the same way if you want it (it is also switched off by default in Settings › Pages).

## What it sets up

- Its own Docker project `enzo-demo` (own containers and volumes), so it never touches a dev stack's database.
- `.env.demo.local` at the repo root, generated on first run (random secrets, `DISABLE_2FA=true`, SMTP to Mailpit). It is git-ignored and your `.env` is never read or changed. Deleting it while the volumes exist breaks the database login: use `reset`.
- The mock data (`npm run mock:seed`), every account with the password `Enzo-Demo-2026` (set `DEMO_PASSWORD` to change it before the first start). Running `demo.cmd` again reloads the mock data from scratch, so the demo goes back to its starting state.
- The website switched to **live** with About, Services, Portfolio, Booking and Contact on.

## Ports

Defaults: site 3000, admin 5174, portal 5175, API 4000, Postgres 5432, Redis 6379, MinIO 9000/9001, Mailpit 8025/1025. If any is taken (a dev stack or dev servers), the script stops before starting and says which. Free them, or choose another set on the first run: `demo.cmd -PortOffset 10000` (site 13000, admin 15174, ...). The ports are fixed when `.env.demo.local` is created; `reset` to change them.

## Email and the Mail page

- **Works:** every email the system sends (client invitations, password resets, enquiry replies, booking confirmations) is caught by Mailpit and shown there. Nothing leaves the machine.
- **Does not work without your Google account:** the admin's **Mail** page is each staff member's own Gmail. It only appears when a Google OAuth client is configured (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_GMAIL_REDIRECT_URI`, see CLAUDE.md). Create one in Google Cloud, add `http://localhost:4000/mailbox/callback` as a redirect URI, put the three values in `.env.demo.local`, and run `demo.cmd` again. Without them the Mail menu entry is absent. The same applies to Sign in with Google and the studio calendar.

## Known limits

- Document and photo uploads go to the local MinIO at the media port above; the browser must be able to reach `localhost:9000` (or the offset one).
- Web Push is off (no VAPID keys); the bell and email work.
- Mock clients have email notifications off on purpose, so nothing is mailed to the fake addresses; invite a mock client from the admin to see an email in Mailpit.
- **Open issue:** on the first start the mock documents upload fine. Running `demo.cmd` a second time reloads the mock rows but the mock file upload fails with "Access Key Id does not exist" (cause not found; MinIO root user matches `.env.demo.local`). If document downloads matter for a showing, run `demo.cmd reset` then `demo.cmd` for a clean start instead of re-running over an existing demo.
