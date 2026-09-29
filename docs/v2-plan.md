# Enzo Interiors v2 plan: clean git, quotes out, CRM and portal in

Status: finalised, not started. Written against `develop` @ `45a357e` and `main` @ `25c42df`.

## 1. Decisions (locked)

| # | Decision |
|---|---|
| 1 | Quotes are removed from the platform. The quote builder lives on as its own project. Its source is on `feature/3d-2d-quote-builder`, archived under a tag. |
| 2 | The web quote calculator is removed and replaced by a "Book a consultation" call to action. |
| 3 | The part library (`components`, the `ComponentItem` price list) goes with quotes. |
| 4 | The CRM's own `bookings` module is retired. `Appointments` replaces it. |
| 5 | Roles become data-driven. Admin creates roles and ticks, per area: View, Create, Edit, Delete, Submit for confirmation, Approve, plus a scope of All records or Assigned only. |
| 6 | Submit-for-confirmation applies to four actions to start: project stage change, create or mark-paid invoice, send document to client, publish CMS. Admin can widen the list later without a code change. |
| 7 | Approvers are Admin plus any role with Approve ticked on that area. |
| 8 | Git keeps its history. A clean baseline is made by merging the two histories, not by rewriting them. |
| 9 | Coolify deploys production on every push to `main`. |
| 10 | Database rules from CLAUDE.md still hold: migrations only add, money is `decimal`, no payment gateway, no tenants. |

## 2. What is wrong with git today

1. `main` is a pruned snapshot of `develop`. Commit `c9f4298` deleted 144 files (`apps/portal`, `promo-video`, `CLAUDE.md`, most of `docs/`, root config) and was merged as PR #25.
2. `main` has 7 production fixes that `develop` lacks: Coolify/Traefik network labels, MinIO image switch, MinIO readiness retry, named images, brand-image validation only on change (`877baa2`, in `site-settings.module.ts`), and the coming-soon and docs changes. Merging `develop` over `main` would silently revert these.
3. The 7 admin-fixes commits exist twice. 3 are identical patches, 4 differ.
4. Tracked junk on `develop`: `.pnpm-store/v11/index.db`, the gitlink `.claude/worktrees/web-nextjs-migration`, and 19 `apps/api/data/*.json` files (nothing in `api/src` or the Dockerfiles uses them).
5. No tags, no `.github/`, 5 test files, and root scripts that only target `web`.
6. 30 remote branches. 16 are merged, 14 are not (leftover stacked PRs, `release/v1.0`, `release/v1.1`, the quote builder).
7. `apps/quote-builder/` is untracked build output (`.next`, `node_modules`) with no source.

**Not junk:** the per-app `package-lock.json` files. Every Dockerfile runs `npm ci` from them. The root `pnpm-lock.yaml` and `pnpm-workspace.yaml` exist only for the shared root lint config that `apps/web` extends, so they stay.

**Key finding:** the `apps/api`, `apps/web` and `apps/admin` trees on `main` and `develop` differ only by the site-settings fix above, the 3 web files below, and `apps/api/data`. Migrations are identical. So a merge where `main` wins for app code and compose gives a baseline whose deployable code is byte-identical to production.

## 3. Git model going forward

- `main`: production only. Changes only by PR from `develop` (merge commit, never squash). Tagged `vX.Y.Z` per release. Every merge deploys.
- `develop`: integration. Protected: PR required, CI green, no force-push.
- Working branches: `feature/`, `fix/`, `chore/`, `docs/`, `hotfix/` plus a slug. Cut from `develop` (`hotfix/` from `main`). One concern per branch. **Squash-merge** into `develop`, then delete the branch. No stacked PRs.
- Hotfix: `hotfix/x` from `main`, PR to `main`, and the same day a PR to `develop`. This step was skipped last time.
- No `release/*` branches. Tags do that job.
- Commits: `feat(api):`, `fix(web):`, `chore:`, `docs:`, imperative and specific.
- PR template: what, why, how tested, how to roll back, migration touched (yes/no), docs updated (yes/no).
- Definition of done for every PR: typecheck, lint, test and build pass for each app touched. Docs and CLAUDE.md updated if structure changed. Migrations add only. RBAC test added if an endpoint or permission changed.
- Rollback: revert the PR (`git revert`), never force-push `main`. Because migrations only add, the previous image runs on the new schema.

## 4. Part A: git cleanup runbook

Nothing here runs until you say go. Each stage has a gate. Stop at a failed gate.

### G0. Tools and safety net

```bash
winget install --id GitHub.cli        # I will confirm source and size with you first
gh auth login                         # you run this; I never enter credentials
git fetch --all --prune --tags
git push origin develop                                        # 7 commits ahead of origin
git bundle create ../enzo-pre-cleanup-$(date +%Y%m%d).bundle --all
git tag -a v1.0.0 340a362 -m "First production release (PR #25)"
git tag -a v1.1.0 25c42df -m "Production before cleanup"
git tag -a archive/develop-pre-cleanup 45a357e -m "develop before cleanup"
git tag -a archive/quote-builder origin/feature/3d-2d-quote-builder -m "3D/2D quote builder source"
# one archive/<name> tag per unmerged branch (ui-tier*, web-*, shared-types-core, ui-states-and-docs)
git push origin --tags
```

**Gate:** the bundle exists and `git tag -l` shows every tag on the remote.

### G1. Baseline branch (merge, `main` wins for code)

```bash
git switch -c chore/repo-baseline develop
git merge --no-ff --no-commit origin/main
```

Expect 6 conflicts (confirmed by a trial `merge-tree`):

- `apps/web/src/components/coming-soon/ComingSoon.tsx`, `ComingSoonNewsletter.tsx` and `newsletter/Newsletter.tsx`: take `main`'s (`git checkout --theirs`). It has the coming-soon work and the later Redis edits.
- `CLAUDE.md`, `docs/architecture.md`, `docs/Enzo_Interiors_Backend_Schema_v2.0.md`: deleted on `main`, kept from `develop` (`git add`).

Then undo the silent deletions from `main`'s prune:

```bash
git diff --cached --name-only --diff-filter=D HEAD | xargs git checkout HEAD --
git commit      # message: "Merge origin/main into develop: baseline with shared history"
```

Second commit, tracked junk:

```bash
git rm -r --cached .pnpm-store
git rm --cached .claude/worktrees/web-nextjs-migration
git rm -r apps/api/data                # re-grep api/src and Dockerfiles for "data/" first
rm -rf apps/quote-builder              # source is safe under archive/quote-builder
```

Third commit, docs: this plan, and a CLAUDE.md update covering the git model above, the one-time `docker network create coolify` for local compose, and the `develop → staging` line (see section 9).

**Gate (most important):**

```bash
git diff --stat origin/main -- apps/api apps/web apps/admin docker-compose.yml .env.example
```

must print nothing. That means the code Coolify builds is identical to what production runs. Also: `docker compose build api web admin` succeeds locally, and `npm ci` plus typecheck and test pass in api, admin and web.

### G2. Land on `develop`, then `main`

1. Push `chore/repo-baseline`. Open the PR into `develop`. Merge with a **merge commit**, not a squash. A squash would drop the ancestry and recreate the divergence.
2. Take a Postgres snapshot (per `docs/prelaunch.md`) and pick a quiet time. The deploy should be a no-op rebuild of identical code, but this is the first push to `main` in the new model.
3. Open PR `develop → main`, merge commit, watch the Coolify deploy: `/health`, site, admin, one booking in the calendar.
4. Tag `pre-quote-removal` on `develop`. No `v` tag, because nothing shipped.

**Rollback:** revert the merge commit on `main` by PR. Coolify redeploys `v1.1.0`'s code.

**Gate:** `git merge-base main develop` equals `main`'s tip, so a fast-forward relation holds from now on.

### G3. Prune branches

- Delete the 16 merged remote branches and `release/v1.0`, `release/v1.1`. The tips are already reachable from `main` or tagged.
- Delete the 14 unmerged ones only after their `archive/*` tag is on the remote.
- Delete matching local branches. Keep only `main` and `develop`.

I list the exact `git push origin --delete` commands and wait for your OK before running them.

### G4. CI, then branch protection

CI (PR 1) comes first so the required checks exist. Then, on `main` and `develop`:

- Require a PR, require the CI checks, no force-push, no deletion.
- Required approvals: 0 while you are the only person (GitHub does not let you approve your own PR). Raise to 1 when a second person joins.
- Allow merge commits and squash. Disable rebase merges.

## 5. Part B: implementation, one PR each

Order matters. Quotes go out and the permission system comes in **before** any CRM module is mounted.

| # | Branch | Scope | Size | Live impact |
|---|---|---|---|---|
| 1 | `chore/ci` | GitHub Actions: per app (`api`, `admin`, `web`, `portal`) Node 22, `npm ci`, typecheck, lint, test, build (portal has no test script). Docker build smoke for api, web and admin on PRs to `main`. PR template. Work out how `apps/web` lint reaches the root `eslint.config.js` and install root tooling in CI if needed. | S | none |
| 2 | `chore/api-test-harness` | Postgres service container, a helper to boot the Nest app against a test DB, first smoke tests. Needed by RBAC and CRM PRs. | M | none |
| 3 | `feature/remove-quotes-api` | Delete `modules/quotes` and the part library (`components`). Strip quote references from invoices (`quote_id` stays as a nullable column), bookings, clients (delete blockers, detail tab) and dashboard stats. Tables stay (migrations only add). | M | none (unmounted) |
| 4 | `feature/remove-quotes-admin-portal` | Admin and portal Quotes pages, nav entries, dashboard tiles, quote types and statuses, `ClientDetail` quote tab. | M | none (unrouted) |
| 5 | `feature/remove-web-calculator` | Delete `Investment*`, `RoomSizeControl`, `QuoteRequestModal`, `quote-estimate.ts`, `IndexPricingScale`. Replace with a "Book a consultation" CTA linking to `/booking`. Edit quote copy out of `services.json` and `service-detail.json`. `cms:import` never removes keys, so existing databases keep the old copy until you edit it out in the admin. List those entries in the PR. | M | **live**, release **v1.2.0** |
| 6 | `docs/remove-quotes` | CLAUDE.md, PRD, TRD, App Flow, websitemap, schema doc. Drop the `/quotes/estimate` promise and the `unit_price` snapshot rule. Mark the quote tables as retired-but-kept. | S | none |
| 7 | `feature/rbac-permissions` | See section 6. New tables `roles`, `role_permissions`, `approval_requests` (add-only). Guard `@RequirePermission(area, action)` replaces the 75 `@Roles` uses across 20 files. Parity test: every live endpoint is allowed or denied for Admin and Editor exactly as before. | L | **live**, highest risk |
| 8 | `feature/rbac-role-editor` | Admin screen under Settings › Users and roles: create and edit roles, permission grid, scope, locked Admin. | M | live (admin only) |
| 9 | `feature/approvals` | Approval requests for the four agreed actions, an approvals inbox, and bell plus email notifications through the existing `notifications` and `MailService`. CMS publish reuses the existing `cms_entries.review_*` flow instead of a second one. Seeded roles default to direct action, so nothing changes on deploy. Release **v1.3.0**. | L | live |
| 10 | `chore/retire-crm-duplicates` | Remove the CRM `BookingsModule` and admin `Bookings.tsx`. Check whether the CRM `ContentModule` and `SettingsModule` are superseded by the CMS and site settings, and remove them if nothing imports them. | S | none |
| 11 | `feature/crm-clients` | Mount Clients in the API and the admin routes. Tests against live Postgres and the RBAC matrix. | M | live |
| 12 | `feature/crm-projects` | Mount Projects: 5-stage Kanban, assignment, stage changes through approvals. Add the flow appointment or enquiry → client → project at the Consultation stage. Add nullable `assigned_installer_id` (only `assigned_designer_id` exists today). | L | live |
| 13 | `feature/crm-invoices` | Mount Invoices: manual mark-paid, no gateway. Today an invoice has `amount` and `vat_rate` and no line items. Decide whether to add an `invoice_items` table (recommended). PDF and email delivery only if the PRD requires it. | M | live |
| 14 | `feature/crm-documents` | Mount Documents on the private bucket with signed URLs generated per request. "Send to client" goes through approvals. | M | live |
| 15 | `feature/crm-dashboard` | Mount the Dashboard, minus quote stats. Release **v2.0.0** once 11 to 15 are in. | S | live |
| 16 | `feature/messages` | Conversations, Socket.IO gateway with authenticated handshake, check it works through the Cloudflare Tunnel, saved replies, offline email. Redis adapter only if you run more than one API instance. | M | live |
| 17 | `feature/portal` | Dockerfile, compose service, tunnel hostname, `/auth/portal/login`, client invites. Client-isolation tests: a client sees only their own records. Release **v2.1.0**. | L | live |
| 18 | `feature/pwa` | Manifest and Workbox service worker for admin and portal. Push only if you confirm it is needed. | M | live |
| 19 | `chore/launch-hardening` | e2e tests in the repo, GlitchTip, backup-restore rehearsal, Instagram feed check. | M | none |

Non-code launch items, tracked in `docs/prelaunch.md`: SMTP provider, Cloudflare WAF and DNS, 27 placeholder images, street address, Search Console.

## 6. Permission system design

**Tables (add-only migration):**

- `roles`: `key` (unique; the value stored in `staff_users.role`), `name`, `is_system`, `created_at`. Seeded: `Admin` (locked, cannot be edited or deleted), `Editor`, `Designer`, `Installer`.
- `role_permissions`: `role_key`, `area`, `can_view`, `can_create`, `can_edit`, `can_delete`, `needs_confirmation`, `can_approve`, `scope` (`all` | `assigned`).
- `approval_requests`: `id`, `action` (e.g. `project.stage_change`), `resource_type`, `resource_id`, `payload` (JSONB, the proposed change), `requested_by`, `status` (`pending` | `approved` | `rejected` | `cancelled`), `decided_by`, `decided_at`, `note`.

**No backfill.** `staff_users.role` is already a plain `String`, not an enum. Existing users keep `Admin`, `Editor` or `Designer` and resolve to the seeded roles of the same key at read time. This respects "no data UPDATE in a migration" and lets the previous image keep running.

**Areas:** Clients, Projects, Invoices, Documents, Messages, Dashboard, Appointments, CMS, Media, Newsletter, Site settings, Users and roles.

**Behaviour:**

- A role that has an action ticked as "submit for confirmation" does not perform it. The API stores an `approval_requests` row, tells approvers through the bell and email, and returns `202 pending`.
- An approver approving runs the stored action through the same service method. The audit log records both requester and approver.
- "Assigned only" scope: projects through `assigned_designer_id` and `assigned_installer_id`, clients through their assigned projects, documents and messages through the project.
- Seeded defaults reproduce today's behaviour. Editor and Designer: CMS edit plus submit-for-review, no publish, no Bookings or Settings. Installer: assigned projects only, stage changes submitted for confirmation.
- Guards enforce everything. No access checks in handlers.

**Tests (PR 7):** a matrix per role, over every mounted endpoint, asserting allowed or denied. It is compared against a snapshot of the current `@Roles` behaviour so that deploying PR 7 changes nobody's access.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Any push to `main` deploys | Protection from G4. Release PRs only. Snapshot before risky releases. |
| PR 7 touches every live endpoint | Parity matrix, low-traffic deploy window, snapshot, and a revert-ready PR. Old image still runs on the new schema. |
| Merge loses the production hotfixes | The G1 gate: the app diff against `origin/main` must be empty. |
| Stale quote copy stays in the CMS | PR 5 lists the entries. Edit them out in the admin. |
| CRM code was only type-checked | Each mount PR runs against live Postgres, with tests first (PR 2). |
| Local compose needs Coolify's network | `docker network create coolify` once; documented in CLAUDE.md. |
| Squashing a release PR recreates divergence | Convention: merge commit for `develop → main`, squash for features. |

## 8. Definition of finished

`main` and `develop` share history and tags exist. CI is required on both. Quote code is gone and the tables remain. The permission system is live with the four confirmations. Clients, Projects, Invoices, Documents, Messages and the Dashboard run in the admin. The portal is deployed. PWA and hardening are done or consciously deferred.

## 9. Assumptions to confirm

- There is no staging deploy from `develop` (the compose file only names production hosts). CLAUDE.md currently says "PR merge to develop → staging deploy". I will reword it unless a staging environment exists.
- PDF and emailed invoices are out of scope unless the PRD says otherwise.
- Push notifications are out of scope for v2 unless you say otherwise.
