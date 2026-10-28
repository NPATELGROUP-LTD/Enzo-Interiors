import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { TeamStore } from '../data/team-store';
import { ADMIN, startTestApp } from './app';

/**
 * Project teams: several designers and installers per project, scope = member,
 * the legacy single-assignment columns as a fallback, and an installer's dates,
 * pay and approvals, which only the Admin and that installer may ever see.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'team-password-123';
const person = (key: string, role: string) => ({ id: `stf_t${key}_${run}`, email: `t-${key}-${run}@test.enzo.local`, role });
const DES_A = person('da', 'Designer');
const DES_B = person('db', 'Designer');
const DES_C = person('dc', 'Designer'); // never a member; only the legacy column names them on LEGACY
const INST_1 = person('i1', 'Installer');
const INST_2 = person('i2', 'Installer');
const INST_3 = person('i3', 'Installer'); // never on the project
const EDITOR = person('ed', 'Editor');
const INFRA = person('in', 'Infra');
const CLIENT = { id: `cli_team_${run}`, email: `t-client-${run}@test.enzo.local` };
const P = { team: `prj_team_${run}`, legacy: `prj_teamleg_${run}`, backfill: `prj_teambf_${run}` };
const PAY = 87654.32; // long enough that no uuid or timestamp in a busy log contains it by chance
const NOTE = `secret handling fee ${run}`;

const tokens = { admin: '', desA: '', desB: '', desC: '', inst1: '', inst2: '', inst3: '', editor: '', infra: '', client: '' };
let adminId = '';
let m1 = ''; // INST_1's member id on P.team
let m2 = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [DES_A, DES_B, DES_C, INST_1, INST_2, INST_3, EDITOR, INFRA]) {
    await prisma.staffUser.create({ data: { ...staff, name: `T ${staff.role} ${staff.id.slice(5, 7)} ${run}`, password_hash } });
  }
  await prisma.client.create({ data: { ...CLIENT, name: 'Team client', joined_date: new Date(), status: 'Active', password_hash } });
  const project = { client_id: CLIENT.id, type: 'Kitchen', status: 'Design', client_visible: true };
  await prisma.project.createMany({
    data: [
      { ...project, id: P.team, name: 'Team job' },
      { ...project, id: P.legacy, name: 'Legacy job', assigned_designer_id: DES_C.id },
      { ...project, id: P.backfill, name: 'Backfill job', assigned_installer_id: INST_3.id },
    ],
  });
  adminId = (await prisma.staffUser.findFirstOrThrow({ where: { email: ADMIN.email } })).id;

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  for (const [key, staff] of Object.entries({ desA: DES_A, desB: DES_B, desC: DES_C, inst1: INST_1, inst2: INST_2, inst3: INST_3, editor: EDITOR, infra: INFRA })) {
    tokens[key as keyof typeof tokens] = await signIn('/auth/admin/login', staff.email, PASSWORD);
  }
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);
});

after(async () => {
  const staffIds = [DES_A, DES_B, DES_C, INST_1, INST_2, INST_3, EDITOR, INFRA].map((staff) => staff.id);
  await prisma.project.deleteMany({ where: { client_id: CLIENT.id } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.notification.deleteMany({ where: { recipient_id: { in: [...staffIds, adminId] }, link: { contains: '/projects/prj_team' } } });
  await prisma.activityLog.deleteMany({ where: { target_id: { in: [...Object.values(P), m1, m2] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.$disconnect();
  await app.close();
});

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  return fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await call('POST', path, undefined, { email, password });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function json<T>(res: Response, status = 200): Promise<T> {
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
}

interface Member {
  id: string;
  staff_id: string;
  role: string;
  assignment?: Record<string, unknown> & { pay: number | null; pay_status: string; dates_status: string; start_date: string | null; sent_at: string | null; suggested_start: string | null };
}
type Detail = { team: Member[]; project: { id: string }; activity: Array<{ target_table: string }> };

const detail = (token: string, id = P.team) => call('GET', `/projects/${id}/detail`, token);
const team = async (token: string) => (await json<Detail>(await detail(token))).team;
const mine = async (token: string, id: string) => (await team(token)).find((member) => member.id === id)!;
const add = (staff: { id: string }, role: string) => call('POST', `/projects/${P.team}/team`, tokens.admin, { staff_id: staff.id, role });
const terms = (id: string, body: unknown) => call('PUT', `/projects/${P.team}/team/${id}/installation`, tokens.admin, body);
const asInstaller = (token: string, id: string, tail: string, body?: unknown) => call('POST', `/projects/${P.team}/team/${id}/${tail}`, token, body ?? {});
const notes = (recipient: string, like: string) =>
  prisma.notification.count({ where: { recipient_id: recipient, link: `/projects/${P.team}`, title: { contains: like } } });

test('several designers and installers share a project; scope is membership, and the old column mirrors the first', async () => {
  for (const [staff, role] of [[DES_A, 'Designer'], [DES_B, 'Designer'], [INST_1, 'Installer'], [INST_2, 'Installer']] as const) {
    await json<Member[]>(await add(staff, role), 201);
  }
  const list = await team(tokens.admin);
  assert.deepEqual(list.map((member) => member.role), ['Designer', 'Designer', 'Installer', 'Installer']);
  m1 = list.find((member) => member.staff_id === INST_1.id)!.id;
  m2 = list.find((member) => member.staff_id === INST_2.id)!.id;

  for (const token of [tokens.desA, tokens.desB, tokens.inst1, tokens.inst2]) {
    assert.equal((await detail(token)).status, 200);
    assert.ok((await json<Array<{ id: string }>>(await call('GET', '/projects', token))).some((row) => row.id === P.team));
  }
  for (const token of [tokens.desC, tokens.inst3]) {
    assert.equal((await detail(token)).status, 404, 'not a member');
    assert.ok(!(await json<Array<{ id: string }>>(await call('GET', '/projects', token))).some((row) => row.id === P.team));
  }
  // The client's page and the dashboard follow the same scope.
  assert.equal((await call('GET', `/clients/${CLIENT.id}`, tokens.desB)).status, 200);
  assert.equal((await call('GET', `/clients/${CLIENT.id}`, tokens.inst3)).status, 200, 'INST_3 is legacy-assigned to the backfill job of this client');
  const tasks = await json<{ tasks: Array<{ id: string; roles: string[] }> }>(await call('GET', '/dashboard/designer', tokens.desB));
  assert.deepEqual(tasks.tasks.find((task) => task.id === P.team)?.roles, ['Designer']);

  const row = await prisma.project.findUniqueOrThrow({ where: { id: P.team } });
  assert.equal(row.assigned_designer_id, DES_A.id);
  assert.equal(row.assigned_installer_id, INST_1.id);
  const named = await json<{ assigned_designer_name: string }>(await call('GET', `/projects/${P.team}`, tokens.admin));
  assert.ok(named.assigned_designer_name.includes(', '), 'both designers are named');

  assert.equal((await add(DES_A, 'Designer')).status, 409, 'already on it');
  assert.equal((await add(INST_1, 'Designer')).status, 400, 'wrong role');
  assert.equal((await add(EDITOR, 'Designer')).status, 400);

  // Removing someone ends their access at once.
  const desB = list.find((member) => member.staff_id === DES_B.id)!.id;
  assert.equal((await call('DELETE', `/projects/${P.team}/team/${desB}`, tokens.admin)).status, 200);
  assert.equal((await detail(tokens.desB)).status, 404);
  assert.equal((await detail(tokens.desA)).status, 200);
});

test('the legacy single-assignment columns still grant access until the backfill, which is idempotent', async () => {
  assert.equal((await detail(tokens.desC, P.legacy)).status, 200, 'legacy designer sees it');
  // Reading the project copied them in; removing the member clears the column too.
  const seen = (await json<Detail>(await detail(tokens.admin, P.legacy))).team;
  assert.deepEqual(seen.map((member) => [member.staff_id, member.role]), [[DES_C.id, 'Designer']]);
  assert.equal(await prisma.projectMember.count({ where: { project_id: P.legacy } }), 1);
  assert.equal((await call('DELETE', `/projects/${P.legacy}/team/${seen[0]!.id}`, tokens.admin)).status, 200);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.legacy } })).assigned_designer_id, null);
  assert.equal((await detail(tokens.desC, P.legacy)).status, 404);

  const store = new TeamStore(prisma as never);
  assert.equal(await store.backfill(P.backfill), 1);
  assert.equal(await store.backfill(P.backfill), 0, 'a second run adds nothing');
  assert.equal(await prisma.projectMember.count({ where: { project_id: P.backfill, staff_id: INST_3.id, role: 'Installer' } }), 1);
  // A person deleted since is skipped, not an error.
  await prisma.project.update({ where: { id: P.legacy }, data: { assigned_designer_id: `gone_${run}` } });
  assert.equal(await store.backfill(P.legacy), 0);
});

test('every team route names its roles: nobody else is let in', async () => {
  const adminOnly: Array<[string, string, unknown?]> = [
    ['POST', `/projects/${P.team}/team`, { staff_id: DES_C.id, role: 'Designer' }],
    ['DELETE', `/projects/${P.team}/team/${m2}`],
    ['PUT', `/projects/${P.team}/team/${m1}/installation`, { pay: 1 }],
    ['POST', `/projects/${P.team}/team/${m1}/send`],
    ['POST', `/projects/${P.team}/team/${m1}/suggestion`, { decision: 'accept' }],
  ];
  const installerOnly: Array<[string, string, unknown?]> = [
    ['POST', `/projects/${P.team}/team/${m1}/pay`, { decision: 'approved', pay: 1 }],
    ['POST', `/projects/${P.team}/team/${m1}/dates/approve`, { start_date: '2030-01-01', end_date: '2030-01-02' }],
    ['POST', `/projects/${P.team}/team/${m1}/dates/suggest`, { start_date: '2030-01-01', end_date: '2030-01-02', comment: 'x' }],
  ];
  for (const [who, token] of Object.entries({ designer: tokens.desA, installer: tokens.inst1, editor: tokens.editor, infra: tokens.infra, client: tokens.client })) {
    for (const [method, path, body] of adminOnly) assert.equal((await call(method, path, token, body)).status, 403, `${who} ${method} ${path}`);
  }
  for (const [who, token] of Object.entries({ admin: tokens.admin, designer: tokens.desA, editor: tokens.editor, infra: tokens.infra, client: tokens.client })) {
    for (const [method, path, body] of installerOnly) assert.equal((await call(method, path, token, body)).status, 403, `${who} ${method} ${path}`);
  }
  assert.equal((await call('GET', `/projects/${P.team}/detail`, tokens.editor)).status, 403);
  assert.equal((await call('GET', `/projects/${P.team}/detail`, tokens.infra)).status, 403);
});

test('pay: the Admin and that installer only, after it is sent; never a list, another member, the client, a log or a bell', async () => {
  assert.equal((await terms(m1, { start_date: '2026-02-31' })).status, 400, 'not a real day');
  assert.equal((await terms(m1, { start_date: '2026-12-10', end_date: '2026-12-01' })).status, 400, 'ends before it starts');
  for (const pay of [-1, 12.345, 'lots']) assert.equal((await terms(m1, { pay })).status, 400, `pay ${pay}`);
  assert.equal((await terms(`nope_${run}`, { pay: 1 })).status, 404);
  const desMember = (await team(tokens.admin)).find((member) => member.role === 'Designer')!;
  assert.equal((await terms(desMember.id, { pay: 1 })).status, 400, 'a designer has no pay');

  const set = await json<Member[]>(await terms(m1, { start_date: '2026-12-01', end_date: '2026-12-05', pay: PAY, pay_note: NOTE }));
  assert.equal(set.find((member) => member.id === m1)?.assignment?.pay, PAY, 'the Admin sees it');
  assert.equal((await call('POST', `/projects/${P.team}/team/${m2}/send`, tokens.admin)).status, 400, 'no dates yet');

  // Before it is sent the installer sees nothing, and cannot answer it.
  const before = await mine(tokens.inst1, m1);
  assert.equal(before.assignment, undefined);
  assert.equal((await asInstaller(tokens.inst1, m1, 'pay', { decision: 'approved', pay: PAY })).status, 404);
  assert.equal((await asInstaller(tokens.inst1, m1, 'dates/approve', { start_date: '2026-12-01', end_date: '2026-12-05' })).status, 404);
  assert.equal(await notes(INST_1.id, 'Installation dates'), 0);

  assert.equal((await call('POST', `/projects/${P.team}/team/${m1}/send`, tokens.admin)).status, 200);
  assert.equal((await call('POST', `/projects/${P.team}/team/${m1}/send`, tokens.admin)).status, 409, 'not twice');
  assert.equal(await notes(INST_1.id, 'Installation dates'), 1, 'told once');

  const own = await mine(tokens.inst1, m1);
  assert.equal(own.assignment?.pay, PAY);
  assert.equal(own.assignment?.start_date, '2026-12-01');

  // Everyone else's view of the same project: no assignment on anyone, no amount or note anywhere in the payload.
  const secrets = [String(PAY), '87654', NOTE];
  for (const [who, token] of Object.entries({ designer: tokens.desA, other_installer: tokens.inst2, client: tokens.client })) {
    const res = await detail(token);
    const text = await res.text();
    for (const secret of secrets) assert.ok(!text.includes(secret), `${who} sees ${secret}`);
    if (who !== 'client') {
      assert.ok((JSON.parse(text) as Detail).team.every((member) => member.assignment === undefined), `${who} sees an assignment`);
    } else assert.deepEqual((JSON.parse(text) as Detail).team, []);
  }
  // Other installers cannot reach it by id either.
  const answers: Record<string, unknown> = {
    pay: { decision: 'approved', pay: PAY },
    'dates/approve': { start_date: '2026-12-01', end_date: '2026-12-05' },
    'dates/suggest': { start_date: '2030-01-01', end_date: '2030-01-02', comment: 'x' },
  };
  for (const [tail, body] of Object.entries(answers)) assert.equal((await asInstaller(tokens.inst2, m1, tail, body)).status, 404, tail);
  // Lists and dashboards carry no pay.
  for (const [who, token] of Object.entries({ admin: tokens.admin, designer: tokens.desA, installer: tokens.inst1 })) {
    for (const path of ['/projects', `/projects/${P.team}`, '/dashboard/designer']) {
      if (who === 'admin' && path === '/dashboard/designer') continue;
      const text = await (await call('GET', path, token)).text();
      for (const secret of secrets) assert.ok(!text.includes(secret), `${who} ${path} shows ${secret}`);
    }
  }
  // Bells and the activity log never hold an amount or the note.
  const bell = await prisma.notification.findMany({ where: { link: { contains: P.team } } });
  const logs = await prisma.activityLog.findMany({ where: { target_table: 'project_members', target_id: m1 } });
  assert.ok(logs.length >= 2, 'the audit trail exists');
  for (const secret of secrets) {
    assert.ok(!JSON.stringify(bell).includes(secret), `a notification holds ${secret}`);
    assert.ok(!JSON.stringify(logs).includes(secret), `the activity log holds ${secret}`);
  }
  assert.ok((await json<Detail>(await detail(tokens.desA))).activity.every((entry) => entry.target_table !== 'project_members'), 'designers do not read terms activity');
  assert.ok((await json<Detail>(await detail(tokens.admin))).activity.some((entry) => entry.target_table === 'project_members'), 'the Admin does');
  const infraLog = await json<Array<{ details: unknown; target_table: string }>>(await call('GET', '/activity-logs', tokens.infra));
  assert.ok(infraLog.filter((row) => row.target_table === 'project_members').every((row) => row.details === null), 'Infra reads no details');
  const adminLog = await (await call('GET', '/activity-logs', tokens.admin)).text();
  for (const secret of secrets) assert.ok(!adminLog.includes(secret), `Settings › activity holds ${secret}`);
});

test('the installer approves pay and dates separately, suggests other dates, and the Admin answers; edits reset approval', async () => {
  const state = async () => (await mine(tokens.inst1, m1)).assignment!;
  const adminBell = (like: string) => prisma.notification.count({ where: { recipient_id: adminId, link: `/projects/${P.team}`, title: { contains: like } } });

  // Pay without dates is valid.
  assert.equal((await asInstaller(tokens.inst1, m1, 'pay', { decision: 'approved', pay: PAY + 1 })).status, 409, 'an amount they did not see');
  await json(await asInstaller(tokens.inst1, m1, 'pay', { decision: 'approved', pay: PAY }));
  assert.equal((await state()).pay_status, 'approved');
  assert.equal((await state()).dates_status, 'pending');
  assert.equal(await adminBell('the pay'), 1, 'the Admin is told');

  // Suggestions need real, different dates and a comment.
  const suggest = (body: unknown) => asInstaller(tokens.inst1, m1, 'dates/suggest', body);
  assert.equal((await suggest({ start_date: '2026-12-01', end_date: '2026-12-05', comment: 'same' })).status, 400, 'those are the dates already');
  assert.equal((await suggest({ start_date: '2026-12-09', end_date: '2026-12-08', comment: 'back to front' })).status, 400);
  assert.equal((await suggest({ start_date: '2026-12-08', end_date: '2026-12-12', comment: '   ' })).status, 400);
  assert.equal((await suggest({ start_date: '2026-12-08', end_date: '2026-12-12' })).status, 400, 'a comment is part of it');
  await json(await suggest({ start_date: '2026-12-08', end_date: '2026-12-12', comment: 'Away until the 7th' }));
  assert.equal((await state()).suggested_start, '2026-12-08');
  assert.equal(await adminBell('suggests'), 1);

  // The Admin declines, then accepts a second one: accepting updates the dates.
  await json(await call('POST', `/projects/${P.team}/team/${m1}/suggestion`, tokens.admin, { decision: 'decline', note: 'Cannot move it' }));
  assert.equal((await state()).suggested_start, null);
  assert.equal((await state()).start_date, '2026-12-01');
  assert.equal(await notes(INST_1.id, 'declined'), 1);
  assert.equal((await call('POST', `/projects/${P.team}/team/${m1}/suggestion`, tokens.admin, { decision: 'accept' })).status, 409, 'nothing to answer');
  await json(await suggest({ start_date: '2026-12-09', end_date: '2026-12-11', comment: 'Van is free then' }));
  await json(await call('POST', `/projects/${P.team}/team/${m1}/suggestion`, tokens.admin, { decision: 'accept' }));
  const accepted = await state();
  assert.deepEqual([accepted.start_date, accepted.end_date, accepted.dates_status, accepted.suggested_start], ['2026-12-09', '2026-12-11', 'approved', null]);
  assert.equal(await notes(INST_1.id, 'accepted'), 1);

  // An Admin edit after approval resets it and tells the installer; the same values do nothing.
  const before = await prisma.notification.count({ where: { recipient_id: INST_1.id, link: `/projects/${P.team}` } });
  await json(await terms(m1, { pay: PAY, pay_note: NOTE, start_date: '2026-12-09' }));
  assert.equal(await prisma.notification.count({ where: { recipient_id: INST_1.id, link: `/projects/${P.team}` } }), before, 'no change, no notice');
  await json(await terms(m1, { pay: 5000 }));
  assert.equal((await state()).pay_status, 'pending', 'new pay, new approval');
  assert.equal((await state()).dates_status, 'approved', 'dates untouched');
  await json(await terms(m1, { end_date: '2026-12-14' }));
  assert.equal((await state()).dates_status, 'pending');
  assert.equal(await notes(INST_1.id, 'changed'), 2);
  assert.equal((await terms(m1, { start_date: null })).status, 400, 'sent dates cannot be cleared');

  await json(await asInstaller(tokens.inst1, m1, 'pay', { decision: 'declined', pay: 5000 }));
  assert.equal((await state()).pay_status, 'declined');
  assert.equal((await asInstaller(tokens.inst1, m1, 'dates/approve', { start_date: '2026-12-09', end_date: '2026-12-11' })).status, 409, 'dates they did not see');
  await json(await asInstaller(tokens.inst1, m1, 'dates/approve', { start_date: '2026-12-09', end_date: '2026-12-14' }));
  assert.equal((await state()).dates_status, 'approved');
  assert.equal((await asInstaller(tokens.inst1, m1, 'pay', { decision: 'maybe', pay: 5000 })).status, 400);
});

test('removing an installer takes their terms with them, and deleting a project takes the team', async () => {
  assert.equal(await prisma.installerAssignment.count({ where: { member_id: m1 } }), 1);
  assert.equal((await call('DELETE', `/projects/${P.team}/team/${m1}`, tokens.admin)).status, 200);
  assert.equal(await prisma.installerAssignment.count({ where: { member_id: m1 } }), 0);
  assert.equal((await detail(tokens.inst1)).status, 404);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.team } })).assigned_installer_id, INST_2.id, 'the mirror moves to the next installer');

  assert.equal((await call('DELETE', `/projects/${P.team}`, tokens.admin, { password: ADMIN.password })).status, 200);
  assert.equal(await prisma.projectMember.count({ where: { project_id: P.team } }), 0);
});
