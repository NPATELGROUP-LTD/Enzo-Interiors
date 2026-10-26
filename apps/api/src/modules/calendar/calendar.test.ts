// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CacheService } from '../../core/cache';
import { seal } from '../../core/crypto';
import { RateLimitStore } from '../../core/rate-limit';
import { CalendarService, eventId, plan } from './calendar.module';

process.env.GOOGLE_CLIENT_ID = 'id';
process.env.GOOGLE_CLIENT_SECRET = 'secret';
process.env.GOOGLE_CALENDAR_REDIRECT_URI = 'http://localhost/cb';
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
delete process.env.REDIS_URL;

const row = { id: 'studio', status: 'connected', calendar_id: 'cal', refresh_token_enc: seal('r'), google_email: 'a@b.c' };

let store: RateLimitStore;
function setup(events: unknown[], tokenReply: unknown = { access_token: 't', expires_in: 3600 }) {
  row.status = 'connected';
  const notes: string[] = [];
  const db = {
    calendarConnections: { findById: async () => row, update: async (_: string, patch: object) => Object.assign(row, patch) },
  };
  store = new RateLimitStore();
  const service = new CalendarService(
    db as never,
    new CacheService(store),
    store,
    {} as never,
    {} as never,
    { notifyAdmins: async (n: { title: string }) => void notes.push(n.title) } as never,
    { report: () => undefined } as never,
  );
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('oauth2')) return new Response(JSON.stringify(tokenReply), { status: 'error' in (tokenReply as object) ? 400 : 200 });
    return new Response(JSON.stringify({ items: events }), { status: 200 });
  }) as typeof fetch;
  return { service, calls, notes };
}

test('only real timed busy events count, and ours are ignored', async () => {
  const timed = { start: { dateTime: '2026-10-07T10:00:00+01:00' }, end: { dateTime: '2026-10-07T11:00:00+01:00' } };
  const { service, calls } = setup([
    { id: '1', ...timed },
    { id: '2', start: { date: '2026-10-07' }, end: { date: '2026-10-08' } },
    { id: '3', ...timed, transparency: 'transparent' },
    { id: '4', ...timed, status: 'cancelled' },
    { id: '5', ...timed, extendedProperties: { private: { enzo: '1' } } },
  ]);
  const busy = await service.busy('2026-10-07', '2026-10-07', 60);
  assert.deepEqual(busy, [{ starts_at: '2026-10-07T09:00:00.000Z', ends_at: '2026-10-07T10:00:00.000Z' }]);
  const reads = () => calls.filter((url) => url.includes('/events')).length;
  assert.equal(reads(), 1);
  assert.deepEqual(await service.busy('2026-11-20', '2026-11-25', 60), [], 'another range is cut from the same window');
  assert.equal((await service.busy('2026-10-06', '2026-10-09', 60)).length, 1);
  assert.equal(reads(), 1, 'no matter what is asked, Google is read once');
  await service.busy('2026-10-07', '2026-10-07', 60, true);
  assert.equal(reads(), 2, 'a booking being made checks Google now');
});

test('a revoked connection is flagged once and then left alone', async () => {
  const { service, notes } = setup([], { error: 'invalid_grant' });
  assert.deepEqual(await service.busy('2026-10-08', '2026-10-08', 60), [], 'fails open');
  assert.deepEqual(await service.busy('2026-10-09', '2026-10-09', 60), []);
  assert.equal(row.status, 'needs_reconnect');
  assert.deepEqual(notes, ['Google Calendar needs reconnecting']);
});

test('reads cannot use up the budget of token refreshes and writes', async () => {
  const { service } = setup([]);
  for (let i = 0; i < 70; i++) await store.hit('google:reads', 60_000);
  assert.deepEqual(await service.busy('2026-10-07', '2026-10-07', 60), [], 'reads are refused, failing open');
  assert.equal(await service['accessToken'](), 't', 'a token refresh still goes through');
});

test('event ids are valid for Google and move on with the generation', () => {
  const first = eventId('abc', 0);
  assert.match(first, /^[0-9a-v]{5,1024}$/);
  assert.equal(first, eventId('abc', 0));
  assert.notEqual(first, eventId('abc', 1));
});

test('what a booking needs from the calendar', () => {
  const base = { status: 'Confirmed', google_event_id: null, google_calendar_id: null } as never;
  assert.equal(plan(base, 'a'), 'insert');
  assert.equal(plan({ ...(base as object), google_event_id: 'e' } as never, 'a'), 'patch', 'no calendar noted: the current one');
  assert.equal(plan({ ...(base as object), google_event_id: 'e', google_calendar_id: 'a' } as never, 'a'), 'patch');
  assert.equal(plan({ ...(base as object), google_event_id: 'e', google_calendar_id: 'old' } as never, 'a'), 'move');
  assert.equal(plan({ ...(base as object), status: 'Cancelled', google_event_id: 'e' } as never, 'a'), 'delete');
  assert.equal(plan({ ...(base as object), status: 'Cancelled' } as never, 'a'), 'none');
});

test('busy events are read page by page', async () => {
  const { service } = setup([]);
  const pages = [
    { items: [{ id: '1', start: { dateTime: '2026-10-07T10:00:00Z' }, end: { dateTime: '2026-10-07T11:00:00Z' } }], nextPageToken: 'p2' },
    { items: [{ id: '2', start: { dateTime: '2026-10-08T10:00:00Z' }, end: { dateTime: '2026-10-08T11:00:00Z' } }] },
  ];
  let n = 0;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(String(url).includes('oauth2') ? { access_token: 't', expires_in: 3600 } : pages[n++]));
  }) as typeof fetch;
  const busy = await service['fetchBusy']('cal', '2026-10-07', '2026-10-08');
  assert.equal(busy.length, 2);
  assert.ok(calls.some((url) => url.includes('pageToken=p2')));
});

test('reconnecting the same Google account keeps the chosen calendar', async () => {
  const idToken = (email: string) =>
    ['x', Buffer.from(JSON.stringify({ aud: 'id', iss: 'accounts.google.com', exp: Date.now() / 1000 + 600, email })).toString('base64url'), 'y'].join('.');
  const run = async (email: string) => {
    const existing = { id: 'studio', status: 'needs_reconnect', calendar_id: 'work', calendar_name: 'Work', google_email: 'a@b.c', refresh_token_enc: 'x' };
    const saved: Record<string, unknown> = {};
    const store = new RateLimitStore();
    const service = new CalendarService(
      {
        calendarConnections: { findById: async () => existing, update: async (_: string, patch: object) => Object.assign(saved, patch) },
        staffUsers: { findById: async () => ({ id: 's', role: 'Admin', name: 'N', email: 'n@x', token_version: 1 }) },
      } as never,
      new CacheService(store),
      store,
      { verifyAsync: async () => ({ purpose: 'calendar', staff: 's', tv: 1, nonce: email }) } as never,
      { record: async () => undefined } as never,
      {} as never,
      { report: () => undefined } as never,
    );
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ refresh_token: 'r', id_token: idToken(email), scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly' }))) as typeof fetch;
    assert.equal(await service.callback('code', 'state'), 'connected');
    return saved;
  };
  assert.equal((await run('a@b.c')).calendar_id, 'work');
  assert.equal((await run('other@b.c')).calendar_id, 'primary');
});
