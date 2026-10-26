import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BadGatewayException, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';

import { AlertingFilter } from '../modules/alerts/alerts.module';
import { clean, fingerprint, whereFrom } from './alert-scrub';
import { AlertService } from './alert.service';

test('clean keeps the first line and drops addresses, tokens, ids and query strings', () => {
  assert.equal(clean('Could not send to jo.bloggs@example.com\nstack…'), 'Could not send to [email]');
  assert.equal(clean('Bad Bearer abc.def.ghi and eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl'), 'Bad Bearer [token] and [token]');
  assert.equal(clean('Row 3f2504e0-4f89-11d3-9a0c-0305e82c3301 missing at /x?token=abc123&b=1'), 'Row [token] missing at /x');
  assert.equal(clean('ab '.repeat(200)).length, 200);
  assert.equal(clean(undefined), '');
});

test('the same problem has the same fingerprint whatever numbers its message carries', () => {
  assert.equal(fingerprint(['error', 'api', 'GET /x', 'Row 12 missing']), fingerprint(['error', 'api', 'GET /x', 'Row 9031 missing']));
  assert.notEqual(fingerprint(['error', 'api', 'GET /x', 'a']), fingerprint(['error', 'web', 'GET /x', 'a']));
});

test('whereFrom gives file:line of our code, never a path', () => {
  const error = new Error('boom');
  error.stack = 'Error: boom\n    at x (/app/node_modules/pkg/index.js:1:1)\n    at run (/app/dist/modules/clients/clients.js:88:13)';
  assert.equal(whereFrom(error), 'clients.js:88');
  assert.equal(whereFrom('nope'), null);
});

/** An AlertService over a fake database and mailbox, with a clock the test moves. */
function setup(settings: { recipients?: string[]; errors_on?: boolean } = { recipients: ['ops@example.com'] }) {
  const mails: Array<{ to: string | string[]; from?: string; subject: string; text: string }> = [];
  const recorded: string[] = [];
  const mail = { send: async (m: (typeof mails)[number]) => (mails.push(m), true), onFailure: undefined as unknown };
  const db = {
    alertSettings: { findById: async () => ({ recipients: settings.recipients ?? [], errors_on: settings.errors_on ?? true }) },
    alertStore: { record: async (a: { id: string }) => void recorded.push(a.id), prune: async () => 0 },
  };
  const service = new AlertService(mail as never, db as never);
  let clock = 1_000_000;
  service.now = () => clock;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { service, mails, recorded, mail, advance: (ms: number) => void (clock += ms), settle };
}

test('one email per problem per 15 minutes, with a count of what was skipped', async () => {
  const { service, mails, recorded, advance, settle } = setup();
  for (let i = 0; i < 4; i++) service.report({ kind: 'error', source: 'api', title: 'Boom', route: 'GET /x', status: 500 });
  await settle();
  assert.equal(mails.length, 1, 'three repeats are counted, not mailed');
  assert.equal(recorded.length, 4, 'but every one is recorded');
  assert.match(mails[0]!.subject, /^\[Enzo\]\[ERROR\] Boom$/);
  advance(16 * 60_000);
  service.report({ kind: 'error', source: 'api', title: 'Boom', route: 'GET /x', status: 500 });
  await settle();
  assert.equal(mails.length, 2);
  assert.match(mails[1]!.text, /Since the last email: 3 more times/);
});

test('a bucket stops at its cap with one notice, and the other buckets carry on', async () => {
  const { service, mails, settle } = setup();
  for (let i = 0; i < 9; i++) service.report({ kind: 'error', source: 'admin', title: `Break ${'x'.repeat(i + 1)}` });
  service.report({ kind: 'error', source: 'api', title: 'Real problem' });
  await settle();
  const subjects = mails.map((m) => m.subject);
  assert.equal(subjects.filter((s) => s.includes('Break')).length, 5, 'the browser bucket holds 5');
  assert.equal(subjects.filter((s) => s.includes('limit reached')).length, 1, 'and says so once');
  assert.ok(subjects.includes('[Enzo][ERROR] Real problem'), 'the API bucket is untouched');
});

test('error alerts can be switched off, urgent ones cannot', async () => {
  const { service, mails, recorded, settle } = setup({ recipients: ['ops@example.com'], errors_on: false });
  service.report({ kind: 'error', source: 'api', title: 'quiet' });
  service.report({ kind: 'urgent', source: 'system', title: 'loud' });
  await settle();
  assert.deepEqual(mails.map((m) => m.subject), ['[Enzo][URGENT] loud']);
  assert.equal(recorded.length, 2, 'both are still recorded');
});

test('with no recipients and no ALERT_TO nothing is sent and nothing throws', async () => {
  const { service, mails, settle } = setup({ recipients: [] });
  delete process.env.ALERT_TO;
  service.report({ kind: 'urgent', source: 'system', title: 'lonely' });
  await settle();
  assert.equal(mails.length, 0);
});

test('a failed customer email is reported, an alert email that fails is not', async () => {
  const { mail, mails, settle } = setup();
  const onFailure = mail.onFailure as (m: unknown, message: string) => void;
  onFailure({}, '550 mailbox jo@example.com unavailable');
  await settle();
  assert.match(mails[0]!.subject, /An email could not be sent: 550 mailbox \[email\] unavailable/);
});

test('the 5xx filter reports server faults with the route as written, and leaves the rest alone', () => {
  const reports: Array<Record<string, unknown>> = [];
  const replies: number[] = [];
  const adapter = { reply: (_res: unknown, _body: unknown, status: number) => void replies.push(status), isHeadersSent: () => false, end: () => undefined };
  const filter = new AlertingFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost, { report: (a: Record<string, unknown>) => void reports.push(a) } as never);
  const host = (path: string) =>
    ({ getType: () => 'http', getArgByIndex: () => ({}), switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: `${path}?token=secret`, route: { path } }), getResponse: () => ({}) }) }) as unknown as ArgumentsHost;

  filter.catch(Object.assign(new Error('Column does not exist'), { code: 'P2022' }), host('/clients/:id'));
  filter.catch(new BadGatewayException('upstream'), host('/a'));
  filter.catch(new NotFoundException(), host('/b'));
  assert.equal(reports.length, 2, 'a 404 is nobody’s alarm');
  assert.deepEqual({ route: reports[0]!.route, title: reports[0]!.title, status: reports[0]!.status }, { route: 'GET /clients/:id', title: 'P2022 Column does not exist', status: 500 });
  assert.deepEqual(replies, [500, 502, 404], 'and Nest still answers exactly as before');
});
