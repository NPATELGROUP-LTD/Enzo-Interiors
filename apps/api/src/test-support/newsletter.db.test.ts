import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { ADMIN, startTestApp } from './app';

let app: Awaited<ReturnType<typeof startTestApp>>;
let auth: Record<string, string>;
before(async () => {
  app = await startTestApp();
  const login = await fetch(`${app.url}/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  auth = { authorization: `Bearer ${((await login.json()) as { access_token: string }).access_token}`, 'content-type': 'application/json' };
});
after(() => app.close());

const send = (method: string, path: string, body?: unknown) =>
  fetch(`${app.url}${path}`, { method, headers: auth, body: body === undefined ? undefined : JSON.stringify(body) });

test('a newsletter keeps its editor blocks beside the sanitised html, and an older one has none', async () => {
  const blocks = [{ id: 'a', type: 'heading', text: 'Hello' }, { id: 'b', type: 'divider' }];
  const created = await send('POST', '/newsletter/campaigns', {
    subject: 'Blocks',
    html: '<h2>Hello</h2><script>alert(1)</script>',
    blocks,
  });
  assert.equal(created.status, 201);
  const row = (await created.json()) as { id: string; html: string; blocks: unknown };
  assert.ok(!row.html.includes('<script'), 'html is still sanitised on save');
  assert.deepEqual(row.blocks, blocks);

  // Saving without blocks (an older client) clears them rather than leaving them out of step with the html.
  const plain = await send('PUT', `/newsletter/campaigns/${row.id}`, { subject: 'Blocks', html: '<p>x</p>' });
  assert.equal(((await plain.json()) as { blocks: unknown }).blocks, null);

  const list = (await (await send('GET', '/newsletter/campaigns')).json()) as Array<{ id: string; blocks: unknown }>;
  assert.equal(list.find((item) => item.id === row.id)?.blocks, null);
});

test('blocks must be a list of objects', async () => {
  const body = { subject: 'Bad', html: '<p>x</p>' };
  assert.equal((await send('POST', '/newsletter/campaigns', { ...body, blocks: 'nope' })).status, 400);
  assert.equal((await send('POST', '/newsletter/campaigns', { ...body, blocks: [1, 'two'] })).status, 400);
});
