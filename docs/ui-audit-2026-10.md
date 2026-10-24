# UI, logic and security audit — October 2026

Run on 2026-10-24 against `develop` (v2.4.0 code) with the mock data from
`npm run mock:seed`. Every admin, portal and public-site route was opened at
1440×900 and 390×844 (headless Edge). Each page was checked automatically for
page-level horizontal overflow, console errors, failed requests, controls
without names or labels, and tap targets under 24px. Every screenshot was
then reviewed by eye. The kanban drag, the chat scroll position and 40 role
boundaries were checked with interaction scripts.

Severity: **High** = broken or misleading for real users. **Medium** = works,
but is clumsy, fragile or wrong in an edge case. **Low** = polish.

---

## High

### H1. Kanban: a dragged card is clipped and hidden inside the board's scroll box
`apps/admin/src/pages/Projects.tsx:71-95, 492-506`

The card moves with a CSS `transform` inside its column. The column sits
inside `div.overflow-x-auto`, and `overflow-x: auto` also turns `overflow-y`
into `auto`. Three things go wrong as a result:

- **Dragging down:** the card renders *behind* the cards below it (no
  z-index, 50% opacity) and stays clipped by the board.
- **Dragging sideways:** the card vanishes, and the board's scroll width grows
  from 1352 to 1653px. A horizontal scrollbar appears and the window pane
  scrolls.
- **The original slot:** it is not kept, so the column reflows under the
  pointer.

**Fix:** render the dragged card in dnd-kit's `<DragOverlay>`, which portals
to `document.body`. Leave the source card in place as a faded placeholder.

### H2. Kanban drag does not work on touch screens
Same file, drag handle (`:88`).

The handle has no `touch-action: none`. When the browser starts scrolling, the
PointerSensor gets a `pointercancel`, so on a phone or tablet a drag just
scrolls the page.

**Fix:** add `touch-none` to the handle, or use `TouchSensor` with a 150ms
delay.

### H3. Chat threads open at the oldest message (admin and portal)
`apps/admin/src/pages/Messages.tsx:180`, `apps/portal/src/pages/Messages.tsx:137`

A 64-message thread opens with `scrollTop` 0 of 6412. The "keep newest in
view" effect runs when `messages` changes. At that moment the container still
shows `LoadingState`, because `loadingThread` only turns false after the
read-mark and the list refetch. Nothing scrolls again once the list mounts.

**Fix:** add the loading flag to the effect's dependencies.

### H4. Messages on a phone is barely usable (admin and portal)
Below `lg`, the conversation list (max 176px) and the thread are stacked under
the page heading:

- The thread gets about 200px of height.
- The composer row (saved-reply select, attach, send) squeezes the textarea to
  about 130px, so the placeholder wraps to "Write a / reply… (Enter".
- The desktop hint "Enter to send, Shift+Enter for a new line" also shows on
  touch screens.
- The empty-state text is cut off ("…below").

**Fix:** a master/detail pattern on small screens (list *or* thread, with a back
button) and a full-width sticky composer. Hide the keyboard hint on touch
screens.

### H5. Opening `/messages?client=<id>` creates a conversation just by viewing
`apps/admin/src/pages/Messages.tsx:59-71` (POST `/conversations` on load)

The empty thread then sits at the top of every staff member's list ("No
messages yet"), and `/messages` auto-selects it.

**Fix:** create the conversation on the first send, or hide empty
conversations from the list unless one is open.

### H6. Clients without portal access can be messaged, and never receive it
`apps/admin/src/pages/ClientDetail.tsx:107`

**Message** is offered for clients who were never invited (in the mock data,
Ben New and Emma Clarke). They cannot sign in, and chat email only goes to
clients with a portal password, so the message is silently undelivered.

**Fix:** disable the button with "Invite them to the portal first", or show a
banner in the thread.

### H7. The public Privacy and Terms pages still contain template placeholders
`/privacy` and `/terms` show these placeholders:

- `[REGISTERED COMPANY NAME]`
- `[COMPANY NUMBER]`
- `[REGISTERED ADDRESS]`
- `[VAT NUMBER]`
- `[ICO REGISTRATION NUMBER]`
- `[PRIVACY EMAIL]`

This is a legal/compliance issue on a live site. Fix it in the CMS (Pages →
Privacy, terms & cookies). The invoice header says "Enzo Interiors LTD.", so
use the same registered name in both places.

---

## Medium

| # | Where | Problem | Fix |
|---|---|---|---|
| M1 | Admin client detail (mobile); enquiries list (mobile) | Long unbroken text is clipped with no wrap and no ellipsis: "Alexandra Montgomery-Fitzwilli…" in the heading, the email in the header and in Contact details. Long enquiry names run off the card and push the chevron out. | `[overflow-wrap:anywhere]` on headings/emails; `min-w-0 truncate` on list rows |
| M2 | Admin Invoices, Projects list; Portal Documents, Invoices (mobile) | Tables are not adapted to phones. Status, due date, total and actions are off-screen; in the portal the **Download** button and the invoice **amount** are hidden behind a sideways scroll with no affordance. | Card rows below `sm`, or pin the amount/action column |
| M3 | Portal invoice detail (mobile) | The A4 sheet is scaled down to about 6px text and cannot be read without pinch-zoom. | Below `sm`, show a readable summary (number, due date, total, lines) and keep the sheet for print |
| M4 | Settings › Opening hours (desktop + mobile), Settings › Newsletter (mobile) | The document itself scrolls (1338/1909/1340px against a 900/844px viewport), so the menu bar and window frame scroll away, unlike every other screen. | Same inner-scroll layout as the other settings pages (`OpeningHours.tsx`, `Newsletter.tsx`) |
| M5 | Kanban card select (`Projects.tsx:121`) | Every card reads "Move to <its own stage>", e.g. "Move to Consultation" on a Consultation card. | Label the current option "Stage: X" and the others "Move to Y" |
| M6 | Kanban card eye button | Icon only; the meaning is only in `title`, which touch screens never show. | Visible "Hidden" chip or a text label |
| M7 | Project stepper, admin + portal (mobile) | Connector lines collapse to a stray dash ("1 2 – 3 · 4 5"). | Shrinkable connectors, or a vertical stepper below `sm` |
| M8 | Invoice editor | `payment_schedule` is never compared with the total, so a schedule that adds up to more or less than "Total payable" prints without warning. | Show "Schedule adds up to £X of £Y" while editing |
| M9 | Both chats | The thread jumps to the bottom on every resync (tab focus, the 20s poll while the socket is down, any new message), even when someone has scrolled up to read history. | Stick to the bottom only when already within ~80px of it |
| M10 | Both chats | `aria-live="polite"` is on the whole thread, so a screen reader reads the entire history when a thread loads. | `aria-live` on a small "new message" region only |
| M11 | Settings › Logo & icon | The logo remove "×" buttons are 15×15px and overlap the image corner. | 32px target, placed outside the image |
| M12 | Admin mobile back links (CMS, Projects, Settings) | Tap targets are about 20px tall. | `min-h-11` (44px) touch area |
| M13 | Portal invoice/project "not found" | The only action is **Try again**, which cannot fix a 404. | "Back to invoices" / "Back to projects" |

---

## Low (polish)

- **L1:** Dashboard counts are zero-padded ("00", "03", "02", "07") in the
  admin, portal and designer dashboards. They read like times or codes; use
  plain numbers.
- **L2:** Tab bars clip on phones with no scroll hint: client detail ("…Docum"),
  project detail ("Invo…"), the invoices filter ("Overdu"), enquiries ("Arch").
- **L3:** The client search placeholder is truncated on phones ("…phone or
  addre").
- **L4:** Settings › Users:
  - The section blurb says "Invite people, Admin or Editor", but Designer is
    also a role (`SiteSettings.tsx:71`).
  - The role dropdowns are not aligned.
  - A legacy *Installer* is shown as "Designer", so saving the row converts
    them silently.
- **L5:** In the invoice editor, the "Customer" and "Job" headings are about
  32px, against 18px everywhere else in the admin.
- **L6:** Client detail (desktop): the Overview card fills half the width and
  the right half is empty.
- **L7:** The activity log shows humanised keys ("Project create", "Project
  stage change") instead of sentences ("Created the project", "Moved to
  Installation").
- **L8:** The admin and portal 404 pages show a "Ctrl K" hint on phones.
- **L9:** Time formats are mixed:
  - Booking settings show "10:00 AM / 03:30 PM".
  - The bookings list shows "9:00am".
  - The site shows "10:00".

  Use 24-hour UK format for staff.
- **L10:** On the mobile bookings list, the meta line truncates the phone number
  ("LE2 1XA · 077…"). Put the phone on its own `tel:` line.
- **L11:** The public home page logs `<path> attribute pathLength: Unexpected end
  of attribute` (an SVG rendered with `pathLength=""`).
- **L12:** The portal's project detail includes internal staff ids
  (`assigned_designer_id`, `assigned_installer_id`). The names alone are enough
  (data minimisation).
- **L13:** The collapsed mobile menu badge sums the other sections (17, 16 or 1
  depending on the page), with no hint of what it counts.

---

## Security and role checks (all passed)

40 API probes were run as each role. The following behaviour was confirmed:

- **Designer:**
  - Sees only clients of their own projects.
  - Gets no money fields in client or project responses.
  - Gets 403 on invoices, the admin dashboard, enquiries, bookings, users and
    the activity log.
  - Gets 404 on other designers' projects, documents and chats.
  - Cannot rename projects or change `client_visible`.
- **Editor:** gets 403 on clients, projects, conversations and documents.
- **Client:**
  - Gets 404 on other clients' projects and documents, on hidden projects, on
    internal documents and on Draft invoices.
  - Has no `storage_url` in any response and no Draft invoices in lists.
  - Cannot approve a project that is not at the approval stage.
  - Gets 403 on staff routes.
- **Accounts:** an Inactive client's sign-in is refused. A client without
  portal access cannot sign in with an empty password.
- **Unauthenticated:** requests get 401.

The only data-minimisation note is L12.

## Not covered

These were not covered by this audit:

- Dark mode.
- Real push delivery and email content (Mailpit).
- File upload flows.
- Scroll-animated sections of the public site. Headless full-page captures do
  not trigger their reveals, so blank bands in those screenshots are not
  findings.

---

## Mock data

`apps/api/scripts/mock-data.ts` writes the mock records next to real data and
never touches real rows. Its scope:

- Every mock id starts with `mock_`, and every email ends in
  `@enzo-mock.test`.
- `mock:clear` deletes only those rows, plus anything the app created for the
  mock accounts while you clicked around (their uploads, messages, invoices,
  notifications and logs).

```bash
# local (apps/api)
npm run mock:seed
npm run mock:clear

# Docker / production server (in the compose project directory)
docker compose run --rm seed npm run mock:seed
docker compose run --rm seed npm run mock:clear
```

Sign-ins:

- **Password:** one password for every mock account, printed by the seed
  (random unless `MOCK_PASSWORD` is set).
- **Staff 2FA:** mock staff (`admin`, `designer`, `designer2`, `installer`,
  `editor` @enzo-mock.test) use the authenticator method. Add the printed
  secret or `otpauth://` link to an authenticator app once. To keep the same
  password and secret across re-seeds, set `MOCK_PASSWORD` and
  `MOCK_TOTP_SECRET` to the printed values.
- **Clients:** they sign in at the portal with the same password:
  - `sarah`: approval waiting, 64-message chat.
  - `alexandra.montgomery.fitzwilliam.henderson.household`: long text
    everywhere.
  - `tom`, `raj`, `oliver`, `zoe`, `bulk0/2/4/6`.
- **Edge cases:**
  - `inactive@` must be refused.
  - `emma@` and `new@` have no portal access.

Mock clients have email notifications switched off, so nothing is mailed to
the fake addresses.

**On production:**

- Future mock consultations hold real booking slots until you clear them.
- The mock totals appear in the dashboard and invoice figures.
- Clear the mock data when you are done.
