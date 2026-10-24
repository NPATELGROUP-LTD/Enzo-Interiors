/**
 * Enzo Interiors — mock data for trying every screen by hand.
 *
 *     npm run mock:seed     # (re)write the mock records, print the sign-ins
 *     npm run mock:clear    # remove them
 *
 * In Docker (production too): docker compose run --rm seed npm run mock:seed
 *
 * Safe next to real data: every row it writes has an id starting "mock_" and
 * every email ends in @enzo-mock.test, and clear only deletes those (plus what
 * the app made for them while you clicked around: their notifications,
 * uploads, messages, invoices). Real rows are never read or changed.
 *
 * Sign-ins: one password for every mock account, random per run unless
 * MOCK_PASSWORD is set. Staff get the authenticator method pre-set with one
 * shared secret (MOCK_TOTP_SECRET, else random), so add it to an
 * authenticator app once. Mock clients have email notifications off, so
 * nothing is mailed to the fake addresses.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import { Prisma, PrismaClient } from '@prisma/client';

import { seal } from '../src/core/crypto';
import { PrivateStorage } from '../src/core/storage';
import { hashPassword } from '../src/modules/auth/auth.service';
import { base32Encode } from '../src/modules/auth/totp';
import { totalsOf } from '../src/modules/invoices/totals';

if (existsSync('.env')) process.loadEnvFile('.env'); // never overrides what is already set

const DOMAIN = 'enzo-mock.test';
const P = 'mock_';
const db = new PrismaClient();
const storage = new PrivateStorage();

const day = 86_400_000;
const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * day);
  d.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return d;
};
const ahead = (days: number, hour = 10) => ago(-days, hour);
const mail = (local: string) => `${local}@${DOMAIN}`;
const pick = <T,>(list: readonly T[], i: number): T => list[i % list.length]!;

/* -------------------------------------------------------------------------- */
/* clear                                                                      */
/* -------------------------------------------------------------------------- */

async function clear(): Promise<void> {
  const mine = { startsWith: P };
  const clients = (await db.client.findMany({ where: { id: mine }, select: { id: true } })).map((c) => c.id);
  const conversations = (
    await db.conversation.findMany({ where: { client_id: { in: clients } }, select: { id: true } })
  ).map((c) => c.id);
  // Files uploaded through the app for mock clients have generated ids, so go by client.
  const docs = await db.documentRecord.findMany({ where: { client_id: { in: clients } } });
  for (const doc of docs) await storage.remove(doc.storage_url);

  const byMockOrClient = { OR: [{ id: mine }, { client_id: { in: clients } }] };
  const counts = await db.$transaction([
    db.message.deleteMany({ where: { OR: [{ id: mine }, { conversation_id: { in: conversations } }] } }),
    db.conversation.deleteMany({ where: byMockOrClient }),
    db.documentRecord.deleteMany({ where: byMockOrClient }),
    db.invoice.deleteMany({ where: byMockOrClient }), // invoice_items cascade
    db.project.deleteMany({ where: byMockOrClient }),
    db.client.deleteMany({ where: { id: mine } }),
    db.notification.deleteMany({
      where: { OR: [{ id: mine }, { recipient_id: mine }, { link: { contains: P } }] },
    }),
    db.pushSubscription.deleteMany({ where: { owner_id: mine } }),
    db.notificationPreference.deleteMany({ where: { OR: [{ id: mine }, { owner_id: mine }] } }),
    db.activityLog.deleteMany({ where: { OR: [{ id: mine }, { staff_id: mine }, { target_id: mine }] } }),
    db.savedReplyTemplate.deleteMany({ where: { OR: [{ id: mine }, { staff_id: mine }] } }),
    db.appointment.deleteMany({ where: { OR: [{ id: mine }, { email: { endsWith: `@${DOMAIN}` } }] } }),
    db.contactSubmission.deleteMany({ where: { OR: [{ id: mine }, { email: { endsWith: `@${DOMAIN}` } }] } }),
    db.newsletterSubscriber.deleteMany({ where: { OR: [{ id: mine }, { email: { endsWith: `@${DOMAIN}` } }] } }),
    db.staffUser.deleteMany({ where: { id: mine } }),
  ]);
  console.log(`Removed ${counts.reduce((n, c) => n + c.count, 0)} mock rows and ${docs.length} files.`);
}

/* -------------------------------------------------------------------------- */
/* fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const STAFF = [
  { id: `${P}admin`, name: 'Maya Admin (mock)', email: mail('admin'), role: 'Admin' },
  { id: `${P}designer`, name: 'Dev Designer (mock)', email: mail('designer'), role: 'Designer' },
  { id: `${P}designer2`, name: 'Priya Shah-Kowalczyk (mock)', email: mail('designer2'), role: 'Designer' },
  { id: `${P}installer`, name: 'Ian Installer (mock)', email: mail('installer'), role: 'Installer' },
  { id: `${P}editor`, name: 'Eve Editor (mock)', email: mail('editor'), role: 'Editor' },
];

// portal: true = can sign in to the portal; false = invited never (no password).
const CLIENTS = [
  { key: 'sarah', name: 'Sarah Jones', phone: '07700 900101', address: '12 Victoria Park Road, Leicester LE2 1XA', portal: true },
  { key: 'tom', name: 'Tom & Lucy Whitfield', phone: '07700 900102', address: '8 Main Street, Oadby, Leicester LE2 5AB', portal: true },
  {
    key: 'long',
    name: 'Alexandra Montgomery-Fitzwilliam-Henderson',
    email: 'alexandra.montgomery.fitzwilliam.henderson.household',
    phone: '+44 (0) 7700 900 103 ext. 4421',
    address: 'Flat 14B, The Old Hosiery Works, 221 Belgrave Gate, Belgrave, Leicester, Leicestershire LE1 3HT, United Kingdom',
    notes: 'Prefers calls after 6pm.\nDog in the house (friendly).\nGate code 4471#.\n\nVery long note to test wrapping: ' + 'lorem ipsum dolor sit amet '.repeat(12),
    portal: true,
  },
  { key: 'raj', name: 'Raj Patel', phone: '07700 900104', address: '3 Holly Close, Wigston LE18 2QP', portal: true },
  { key: 'emma', name: 'Emma Clarke', phone: null, address: null, portal: false },
  { key: 'oliver', name: 'Oliver Brown', phone: '07700 900106', address: '19 Station Road, Glenfield LE3 8BT', portal: true },
  { key: 'inactive', name: 'Hannah Inactive', phone: '07700 900107', address: '5 Mill Lane, Syston LE7 1NS', portal: true, status: 'Inactive' },
  { key: 'zoe', name: 'Zoë Ødegård-Łukasz', phone: '07700 900108', address: '77 Narborough Road, Leicester LE3 0LF', portal: true },
  { key: 'new', name: 'Ben New (no projects)', phone: '07700 900109', address: null, portal: false },
  ...['Grace Hall', 'Jack Wilson', 'Mia Turner', 'Noah Evans', 'Ruby Scott', 'Leo Hughes', 'Isla Green'].map((name, i) => ({
    key: `bulk${i}`,
    name,
    phone: `07700 9002${String(i).padStart(2, '0')}`,
    address: `${10 + i} Example Avenue, Leicester LE${i + 1} 2AA`,
    portal: i % 2 === 0,
  })),
] as const satisfies readonly {
  key: string; name: string; phone: string | null; address: string | null; portal: boolean;
  email?: string; notes?: string; status?: string;
}[];

const cid = (key: string) => `${P}cli_${key}`;

// [id suffix, client key, name, type, stage, designer, installer, visible]
const PROJECTS: [string, string, string, string, string, string | null, string | null, boolean][] = [
  ['kitchen', 'sarah', 'Shaker kitchen in sage green', 'Kitchen', 'Installation', 'designer', 'installer', true],
  ['wardrobe', 'sarah', 'Main bedroom fitted wardrobes', 'Wardrobe', 'Approval', 'designer', null, true],
  ['media', 'tom', 'Media wall with fireplace and floating shelves', 'MediaWall', 'Design', 'designer', null, true],
  ['bedroom', 'tom', 'Loft bedroom', 'Bedroom', 'Consultation', 'designer2', null, false],
  [
    'longname', 'long',
    'Complete ground-floor renovation: open-plan kitchen, utility room, boot room and a bespoke larder with oak internals',
    'Kitchen', 'Design', 'designer2', 'installer', true,
  ],
  ['long2', 'long', 'Walk-in wardrobe', 'Wardrobe', 'Completed', 'designer2', 'installer', true],
  ['raj1', 'raj', 'Kitchen island and pantry', 'Kitchen', 'Approval', 'designer', 'installer', true],
  ['oliver1', 'oliver', 'Home office built-ins', 'Bedroom', 'Completed', 'designer', 'installer', true],
  ['inactive1', 'inactive', 'Alcove cabinets', 'MediaWall', 'Completed', 'designer2', null, true],
  ['zoe1', 'zoe', 'Handleless gloss kitchen', 'Kitchen', 'Installation', 'designer2', 'installer', true],
  ['emma1', 'emma', 'Sliding-door wardrobe', 'Wardrobe', 'Consultation', null, null, false],
  ...[0, 1, 2, 3, 4, 5, 6].map((i): [string, string, string, string, string, string | null, string | null, boolean] => [
    `bulk${i}`, `bulk${i}`, `${pick(['Utility room', 'Kids bedroom', 'TV unit', 'Dressing room', 'Galley kitchen', 'Boot room', 'Loft storage'], i)}`,
    pick(['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe'], i), pick(['Consultation', 'Design', 'Approval', 'Installation', 'Completed', 'Design', 'Consultation'], i),
    i % 2 ? 'designer' : 'designer2', i % 3 ? null : 'installer', i % 2 === 0,
  ]),
];
const PROGRESS: Record<string, number> = { Consultation: 10, Design: 35, Approval: 60, Installation: 80, Completed: 100 };

/* -------------------------------------------------------------------------- */
/* seed                                                                       */
/* -------------------------------------------------------------------------- */

const MIN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function seed(): Promise<void> {
  const password = process.env.MOCK_PASSWORD || `Mock-${randomBytes(9).toString('base64url')}`;
  const totpSecret = process.env.MOCK_TOTP_SECRET || base32Encode(randomBytes(20));
  const hash = await hashPassword(password);
  let sealed: string | null = null;
  try {
    sealed = seal(totpSecret);
  } catch {
    console.warn('APP_ENCRYPTION_KEY is not set: mock staff will choose their two-step method at first sign-in.');
  }

  await db.staffUser.createMany({
    data: STAFF.map((s) => ({
      ...s,
      password_hash: hash,
      ...(sealed ? { two_factor_method: 'totp', totp_secret_enc: sealed, totp_confirmed_at: new Date() } : {}),
    })),
  });

  const sid = (key: string | null) => (key ? `${P}${key}` : null);
  await db.client.createMany({
    data: CLIENTS.map((c, i) => ({
      id: cid(c.key),
      name: c.name,
      email: mail('email' in c ? c.email : c.key),
      phone: c.phone,
      address: c.address,
      status: 'status' in c ? c.status : 'Active',
      notes: 'notes' in c ? c.notes : null,
      joined_date: ago(400 - i * 20),
      password_hash: c.portal ? hash : '',
    })),
  });
  // Mock clients: bell + devices on, email off (the addresses are fake).
  const off = { in_app: true, email: false, push: true };
  await db.notificationPreference.createMany({
    data: CLIENTS.map((c) => ({
      id: `${P}pref_${c.key}`, owner_id: cid(c.key), owner_type: 'Client', email_enabled: false,
      categories: { project: off, invoice: off, document: off, message: off },
    })),
  });

  await db.project.createMany({
    data: PROJECTS.map(([id, client, name, type, status, designer, installer, visible], i) => ({
      id: `${P}prj_${id}`, client_id: cid(client), name, type, status,
      progress_pct: PROGRESS[status], current_stage: status === 'Installation' ? 'Carcasses fitted, worktops templated' : null,
      assigned_designer_id: sid(designer), assigned_installer_id: sid(installer), client_visible: visible,
      created_at: ago(200 - i * 9), updated_at: ago(i % 6),
    })),
  });

  /* invoices: every status, sections, quantity-only rows, discount, schedule */
  const kitchenLines = [
    { section: 'Cabinetry', description: 'Base units, painted Shaker, sage', quantity: 9, unit_price: 420 },
    { section: 'Cabinetry', description: 'Wall units', quantity: 6, unit_price: 310, detail: 'Soft-close, internal LED strip' },
    { section: 'Worktops', description: 'Quartz worktop, 30mm, Calacatta', quantity: 1, unit_price: 3250 },
    { section: 'Worktops', description: 'Upstand and splashback cut-outs', quantity: 4, unit_price: 0 },
    { section: 'Installation', description: 'Fitting team, 4 days', quantity: 4, unit_price: 560 },
  ];
  const INVOICES: { id: string; client: string; project: string | null; status: string; due: Date; lines: typeof kitchenLines; discount?: number; schedule?: boolean }[] = [
    { id: 'sarah_dep', client: 'sarah', project: 'kitchen', status: 'Paid', due: ago(60), lines: [{ section: 'Deposit', description: '30% deposit, kitchen', quantity: 1, unit_price: 4200 }] },
    { id: 'sarah_stage', client: 'sarah', project: 'kitchen', status: 'Sent', due: ahead(14), lines: kitchenLines, discount: 500, schedule: true },
    { id: 'sarah_draft', client: 'sarah', project: 'wardrobe', status: 'Draft', due: ahead(30), lines: [{ section: 'Wardrobes', description: 'Hinged doors, 3m run', quantity: 1, unit_price: 3900 }] },
    { id: 'tom_over', client: 'tom', project: 'media', status: 'Overdue', due: ago(21), lines: [{ section: 'Design', description: 'Design fee and 3D visual', quantity: 1, unit_price: 450 }] },
    { id: 'long_big', client: 'long', project: 'longname', status: 'Sent', due: ahead(7), lines: [...kitchenLines, ...kitchenLines.map((l) => ({ ...l, section: `${l.section} (utility)` }))], discount: 1250.5, schedule: true },
    { id: 'long_paid', client: 'long', project: 'long2', status: 'Paid', due: ago(90), lines: [{ section: 'Wardrobe', description: 'Walk-in wardrobe complete', quantity: 1, unit_price: 8999.99 }] },
    { id: 'raj_sent', client: 'raj', project: 'raj1', status: 'Sent', due: ahead(3), lines: [{ section: 'Island', description: 'Island with seating overhang', quantity: 1, unit_price: 5400 }] },
    { id: 'oliver_paid', client: 'oliver', project: 'oliver1', status: 'Paid', due: ago(120), lines: [{ section: 'Office', description: 'Desk wall and shelving', quantity: 1, unit_price: 6100 }] },
    { id: 'oliver_noproj', client: 'oliver', project: null, status: 'Paid', due: ago(30), lines: [{ section: 'Extras', description: 'Extra shelves (no project)', quantity: 3, unit_price: 85 }] },
    { id: 'zoe_over', client: 'zoe', project: 'zoe1', status: 'Overdue', due: ago(45), lines: [{ section: 'Kitchen', description: 'Second stage payment', quantity: 1, unit_price: 7300 }] },
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
      id: `bulk${i}`, client: `bulk${i}`, project: `bulk${i}`, status: pick(['Paid', 'Sent', 'Draft', 'Overdue', 'Paid', 'Sent', 'Paid'], i),
      // Due dates that fit the status: Overdue is past, Sent and Draft are ahead.
      due: [1, 2, 5].includes(i) ? ahead(i * 5) : ago(i * 30 + 10), lines: [{ section: 'Works', description: 'Supply and fit', quantity: 1, unit_price: 1500 + i * 950 }],
    })),
  ];
  const spent: Record<string, Prisma.Decimal> = {};
  for (const [n, inv] of INVOICES.entries()) {
    const totals = totalsOf(inv.lines, 20, inv.discount ?? 0);
    const created = new Date(inv.due.getTime() - 30 * day);
    if (inv.status === 'Paid') spent[inv.client] = (spent[inv.client] ?? new Prisma.Decimal(0)).add(totals.gross);
    await db.invoice.create({
      data: {
        id: `${P}inv_${inv.id}`, number: `MOCK-${String(n + 1).padStart(4, '0')}`, client_id: cid(inv.client),
        project_id: inv.project ? `${P}prj_${inv.project}` : null, amount: totals.gross, vat_rate: 20, status: inv.status,
        due_date: inv.due, paid_at: inv.status === 'Paid' ? new Date(inv.due.getTime() - 2 * day) : null,
        created_at: created, discount: inv.discount ?? 0,
        job_name: inv.project ? PROJECTS.find((p) => p[0] === inv.project)?.[2] : null,
        job_address: CLIENTS.find((c) => c.key === inv.client)?.address ?? null,
        job_notes: inv.schedule ? 'Access via side gate. Skip on the drive for 2 days.' : null,
        payment_schedule: inv.schedule
          ? [
              { label: '30% deposit', amount: Math.round(totals.gross * 0.3) },
              { label: 'On installation', amount: Math.round(totals.gross * 0.6) },
              { label: 'On completion', amount: +(totals.gross - Math.round(totals.gross * 0.3) - Math.round(totals.gross * 0.6)).toFixed(2) },
            ]
          : [],
        items: { create: inv.lines.map((l, position) => ({ id: `${P}item_${inv.id}_${position}`, position, detail: null, ...l })) },
      },
    });
  }
  for (const [key, total] of Object.entries(spent)) await db.client.update({ where: { id: cid(key) }, data: { total_spent: total } });

  /* documents: real (tiny) files in the private bucket so downloads work */
  const DOCS: [string, string, string, string, boolean, Buffer, string][] = [
    ['sarah_plan', 'sarah', 'kitchen', 'Kitchen layout v3.pdf', true, MIN_PDF, 'Plan'],
    ['sarah_contract', 'sarah', 'kitchen', 'Signed contract.pdf', true, MIN_PDF, 'Contract'],
    ['sarah_internal', 'sarah', 'kitchen', 'Supplier price list (internal).pdf', false, MIN_PDF, 'Plan'],
    ['sarah_mood', 'sarah', 'wardrobe', 'Wardrobe mood board.png', true, MIN_PNG, 'MoodBoard'],
    ['tom_plan', 'tom', 'media', 'Media wall elevation.pdf', true, MIN_PDF, 'Plan'],
    ['tom_hidden_proj', 'tom', 'bedroom', 'Loft survey (project not shared).pdf', true, MIN_PDF, 'Plan'],
    ['long_doc', 'long', 'longname', 'Ground floor renovation — full specification, revision 12 FINAL (approved by client) v2.pdf', true, MIN_PDF, 'Contract'],
    ['raj_plan', 'raj', 'raj1', 'Island drawing.pdf', true, MIN_PDF, 'Plan'],
    ['zoe_mood', 'zoe', 'zoe1', 'Gloss colour options.png', true, MIN_PNG, 'MoodBoard'],
  ];
  const s3Ok = { value: true };
  for (const [id, client, project, name, visible, body, type] of DOCS) {
    const key = `clients/${cid(client)}/projects/${P}prj_${project}/${randomUUID()}-${name}`;
    const mime = name.endsWith('.png') ? 'image/png' : 'application/pdf';
    try {
      await storage.put(key, body, mime);
    } catch (error) {
      if (s3Ok.value) console.warn(`Could not upload mock files (${(error as Error).message}); rows are created, downloads will fail.`);
      s3Ok.value = false;
    }
    await db.documentRecord.create({
      data: { id: `${P}doc_${id}`, client_id: cid(client), project_id: `${P}prj_${project}`, name, type, size_bytes: body.length, upload_date: ago(DOCS.length - DOCS.findIndex((d) => d[0] === id)), client_visible: visible, storage_url: key },
    });
  }

  /* messages: one long thread (scrolling), unread on both sides, attachments, awkward text */
  const LINES = [
    'Hi! Just checking when the fitters arrive on Monday?',
    'Morning Sarah, they will be with you at 8am.',
    'Perfect, thank you 😊',
    'Here is the link to the worktop sample we discussed: https://example.com/samples/quartz/calacatta-gold-30mm-polished-edge-profile-ogee-reference-QZ-2291-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'Supercalifragilisticexpialidociousandthenamuchlongerwordwithnospacesatalltotestwrappinginthebubble',
    'Can we move the hob 10cm to the left?\nAlso, the plinth colour:\n- sage\n- or oak?\n\nThanks',
  ];
  const THREADS: [string, number, number, string][] = [
    // client, messages, unread from the client (staff side unread), staff to client unread
    ['sarah', 64, 3, 'designer'],
    ['tom', 6, 1, 'designer'],
    ['long', 12, 0, 'designer2'],
    ['raj', 2, 2, 'designer'],
    ['zoe', 4, 0, 'designer2'],
    ['oliver', 1, 0, 'designer'],
  ];
  for (const [client, count, unread, staff] of THREADS) {
    const conv = `${P}conv_${client}`;
    const name = CLIENTS.find((c) => c.key === client)!.name;
    await db.conversation.create({ data: { id: conv, client_id: cid(client), subject: `Messages with ${name}`, created_at: ago(count) } });
    await db.message.createMany({
      data: Array.from({ length: count }, (_, i) => {
        const fromClient = i % 2 === 0;
        const last = i >= count - unread;
        const attach = client === 'sarah' && i === 10;
        return {
          id: `${P}msg_${client}_${String(i).padStart(3, '0')}`, conversation_id: conv,
          sender_id: fromClient ? cid(client) : `${P}${staff}`, sender_type: fromClient ? 'Client' : 'Staff',
          body: attach ? '' : `${LINES[i % LINES.length]}${count > 20 ? ` (#${i + 1})` : ''}`,
          attachments: attach ? [{ document_id: `${P}doc_sarah_plan`, name: 'Kitchen layout v3.pdf', size_bytes: MIN_PDF.length }] : Prisma.DbNull,
          read_at: last && fromClient ? null : new Date(Date.now() - (count - i) * 3_600_000 + 60_000),
          created_at: new Date(Date.now() - (count - i) * 3_600_000),
        };
      }),
    });
  }
  await db.savedReplyTemplate.createMany({
    data: [
      { id: `${P}reply_1`, staff_id: null, title: 'Fitting day', body: 'Our fitters will arrive between 8 and 9am. Please clear the area beforehand.' },
      { id: `${P}reply_2`, staff_id: `${P}designer`, title: 'Design ready', body: 'Your design is ready to review in the portal under Projects.' },
    ],
  });

  /* consultations: past, upcoming, cancelled (future confirmed ones hold real slots) */
  const APPTS: [number, number, string, string, boolean][] = [
    [-30, 10, 'Sarah Jones', 'sarah', false], [-12, 14, 'Raj Patel', 'raj', false], [-3, 11, 'Walk-in Visitor', 'visitor1', true],
    [2, 10, 'Grace Hall', 'bulk0', false], [3, 15, 'Leo Hughes', 'bulk5', false], [9, 11, 'Long Name Person With A Very Long Surname Indeed', 'visitor2', false],
    [9, 14, 'Cancelled Caller', 'visitor3', true], [16, 10, 'Isla Green', 'bulk6', false],
  ];
  for (const [i, [offset, hour, name, key, cancelled]] of APPTS.entries()) {
    const starts = offset < 0 ? ago(-offset, hour) : ahead(offset, hour);
    starts.setUTCMinutes(0);
    // Weekends are closed: nudge to Monday.
    while ([0, 6].includes(starts.getUTCDay())) starts.setTime(starts.getTime() + day);
    await db.appointment.createMany({
      skipDuplicates: true, // a real booking already holds this slot
      data: {
        id: `${P}appt_${i}`, reference: `EZ-MOCK${String(i).padStart(2, '0')}`, service: pick(['kitchens', 'bedrooms', 'media-walls', 'wardrobes'], i),
        service_label: pick(['Bespoke Kitchens', 'Fitted Bedrooms', 'Media Walls', 'Fitted Wardrobes'], i), starts_at: starts, ends_at: new Date(starts.getTime() + 3_600_000),
        slot: cancelled ? null : starts.toISOString(), status: cancelled ? 'Cancelled' : 'Confirmed', name, email: mail(key),
        phone: '07700 900500', postcode: 'LE2 1XA', notes: i === 5 ? 'Wants a full ground floor quote. '.repeat(8) : null,
        source: i % 2 ? 'website' : 'admin', created_by: i % 2 ? null : pick(STAFF, 0).name, cancelled_at: cancelled ? ago(4) : null,
        created_at: ago(Math.max(1, 40 - i * 4)),
      },
    });
  }

  /* enquiries: every status and kind, enough to page */
  await db.contactSubmission.createMany({
    data: Array.from({ length: 28 }, (_, i) => ({
      id: `${P}enq_${String(i).padStart(2, '0')}`, name: i === 0 ? 'Bartholomew Featherstonehaugh-Cholmondeley' : `Enquirer ${i + 1}`,
      email: mail(`enquiry${i}`), phone: i % 3 ? '07700 900600' : null, service_interest: pick(['Kitchens', 'Bedrooms', 'Media walls', null], i),
      message: i === 0 ? 'We are renovating a Victorian terrace and want everything bespoke. '.repeat(10) : `Hello, I would like a quote for a new room. (${i + 1})`,
      status: pick(['New', 'New', 'Contacted', 'Converted', 'Archived'], i), kind: pick(['contact', 'quote', 'booking'], i),
      details: i % 3 === 1 ? { budget: '£10k–£20k', timeline: 'Within 3 months', rooms: ['Kitchen', 'Utility'] } : Prisma.DbNull,
      created_at: ago(i * 2, 9 + (i % 8)),
    })),
  });

  await db.newsletterSubscriber.createMany({
    data: ['pending', 'confirmed', 'unsubscribed', 'pending', 'confirmed', 'pending'].map((status, i) => ({
      id: `${P}sub_${i}`, email: mail(`news${i}`), status, token: `${P}${randomBytes(12).toString('hex')}`, source: i % 2 ? 'footer' : 'coming-soon',
      created_at: ago(30 - i), confirm_sent_at: ago(30 - i), confirmed_at: status === 'confirmed' ? ago(29 - i) : null,
      unsubscribed_at: status === 'unsubscribed' ? ago(5) : null,
    })),
  });

  /* bells: staff and clients, read and unread */
  const NOTES: [string, string, string | null, string][] = [
    ['enquiry', 'New enquiry from Enquirer 1', 'Hello, I would like a quote for a new room.', '/enquiries'],
    ['message', 'New message from Sarah Jones', null, `/messages?client=${cid('sarah')}`],
    ['booking', 'New consultation booked', 'Grace Hall, Kitchens', '/bookings'],
    ['project', 'Sarah Jones approved "Main bedroom fitted wardrobes"', null, `/projects/${P}prj_wardrobe`],
    ['review', 'Eve Editor (mock) sent Home for review', 'Changed the hero heading, please check the wording on mobile.', '/cms'],
  ];
  const bells: Prisma.NotificationCreateManyInput[] = [
    ...STAFF.filter((s) => s.role !== 'Editor').flatMap((s) =>
      NOTES.map(([kind, title, body, link], i) => ({ id: `${P}note_${s.id}_${i}`, recipient_id: s.id, kind, title, body, link, read_at: i > 2 ? ago(1) : null, created_at: ago(i, 8 + i) })),
    ),
    ...['sarah', 'tom', 'long'].flatMap((c) => [
      { id: `${P}note_${c}_0`, recipient_id: cid(c), kind: 'project', title: 'Your project moved to Approval', body: 'Please review the design.', link: '/projects', read_at: null, created_at: ago(1) },
      { id: `${P}note_${c}_1`, recipient_id: cid(c), kind: 'invoice', title: 'New invoice', body: null, link: '/invoices', read_at: ago(2), created_at: ago(3) },
      { id: `${P}note_${c}_2`, recipient_id: cid(c), kind: 'message', title: 'New message from Enzo Interiors', body: null, link: '/messages', read_at: null, created_at: ago(0) },
    ]),
  ];
  await db.notification.createMany({ data: bells });

  await db.activityLog.createMany({
    data: Array.from({ length: 24 }, (_, i) => ({
      id: `${P}log_${i}`, staff_id: pick(STAFF, i).id, actor_type: 'Staff', actor_name: pick(STAFF, i).name,
      action: pick(['project_create', 'project_stage_change', 'project_update', 'invoice_update'], i), target_table: pick(['projects', 'projects', 'projects', 'invoices'], i),
      target_id: `${P}prj_kitchen`, details: { note: `Mock activity ${i + 1}` }, created_at: ago(i, 9 + (i % 9)),
    })),
  });

  const portal = CLIENTS.filter((c) => c.portal && !('status' in c));
  console.log(`
Mock data written. Remove it with: npm run mock:clear

Password (every mock account): ${password}
Authenticator secret (all mock staff): ${sealed ? totpSecret : '(not set, see warning above)'}
  otpauth://totp/Enzo%20mock?secret=${totpSecret}&issuer=Enzo%20Interiors

Staff (admin app):
${STAFF.map((s) => `  ${s.role.padEnd(9)} ${s.email}`).join('\n')}
Clients (portal):
${portal.map((c) => `  ${mail('email' in c ? c.email : c.key)}`).join('\n')}
  (Hannah Inactive is Inactive: sign-in must be refused. Emma Clarke and Ben New have no portal access.)

Note: future mock consultations hold real booking slots until cleared.`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== 'seed' && mode !== 'clear') throw new Error('Usage: tsx scripts/mock-data.ts seed|clear');
  await clear();
  if (mode === 'seed') await seed();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
