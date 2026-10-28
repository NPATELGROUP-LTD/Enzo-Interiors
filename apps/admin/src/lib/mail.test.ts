import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailMessage } from '../types/mail.ts';
import { addressesIn, draftFor, hasRemoteImages, srcDoc } from './mail.ts';

const message = (over: Partial<MailMessage> = {}): MailMessage => ({
  id: 'm1', thread_id: 't1', from: { name: 'Jo', email: 'jo@client.example' }, to: [{ name: '', email: 'me@enzo.test' }, { name: '', email: 'kim@enzo.test' }],
  cc: [{ name: '', email: 'lee@x.test' }], reply_to: null, subject: 'Kitchen', date: '2026-10-27T10:00:00Z', unread: false, text: 'Hello\nthere', html: null,
  truncated: false, inline_images: false, attachments: [{ part_id: '1', filename: 'plan.pdf', mime: 'application/pdf', size: 5 }], ...over,
});

test('reply goes to the sender, reply-all adds the rest but not you, and the subject is prefixed once', () => {
  const reply = draftFor('reply', message(), 'me@enzo.test');
  assert.deepEqual([reply.to, reply.cc, reply.subject, reply.replyToId], ['jo@client.example', '', 'Re: Kitchen', 'm1']);
  assert.match(reply.body, /wrote:\n> Hello\n> there$/);
  const all = draftFor('reply_all', message({ subject: 'RE: Kitchen' }), 'ME@enzo.test');
  assert.deepEqual([all.to, all.cc, all.subject], ['jo@client.example', 'kim@enzo.test, lee@x.test', 'RE: Kitchen']);
  assert.equal(draftFor('reply', message({ reply_to: { name: '', email: 'office@client.example' } }), 'me@enzo.test').to, 'office@client.example');
});

test('answering your own message goes to its recipients; forward carries the files and no recipient', () => {
  assert.equal(draftFor('reply', message({ from: { name: '', email: 'me@enzo.test' } }), 'me@enzo.test').to, 'me@enzo.test, kim@enzo.test');
  const fwd = draftFor('forward', message(), 'me@enzo.test');
  assert.deepEqual([fwd.to, fwd.subject, fwd.forwardId, fwd.forwardFiles?.length, fwd.replyToId], ['', 'Fwd: Kitchen', 'm1', 1, undefined]);
  assert.match(fwd.body, /Forwarded message[\s\S]*Subject: Kitchen[\s\S]*Hello\nthere$/);
});

test('addresses are picked out of pasted text', () => {
  assert.deepEqual(addressesIn('Jo Bloggs <jo@x.com>; "Kim" <kim@y.org>, jo@x.com  nonsense'), ['jo@x.com', 'kim@y.org']);
});

test('images stay off until asked: the frame policy only names pictures once allowed', () => {
  assert.equal(hasRemoteImages('<p>hi</p><img src="https://t.example/p.gif">'), true);
  assert.equal(hasRemoteImages('<p style="background:url(https://t.example/x.png)">'), true);
  assert.equal(hasRemoteImages('<p>hi</p>'), false);
  assert.match(srcDoc('<p>x</p>', false), /img-src data:"/);
  assert.match(srcDoc('<p>x</p>', true), /img-src data: https: http:"/);
  assert.match(srcDoc('<p>x</p>', false), /script-src 'none'/);
});
