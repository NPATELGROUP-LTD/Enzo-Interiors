import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMime, cleanMailHtml, collect, decodeWords, domainsOf, encodeWords, fileParam, parseAddresses, toMessage } from './mime';

test('addresses: quoted commas, encoded names, and junk dropped', () => {
  const list = parseAddresses('"Doe, Jo" <jo@x.com>, =?UTF-8?B?w4lsaXNl?= <elise@y.org>, plain@z.io, not-an-address, <bad@@x>');
  assert.deepEqual(list, [
    { name: 'Doe, Jo', email: 'jo@x.com' },
    { name: 'Élise', email: 'elise@y.org' },
    { name: '', email: 'plain@z.io' },
  ]);
});

test('encoded words: adjacent words join, bad charsets are left alone', () => {
  assert.equal(decodeWords('=?UTF-8?Q?Caf=C3=A9?= =?UTF-8?Q?_ready?='), 'Café ready');
  assert.equal(decodeWords('=?no-such-charset?B?aGk=?='), '=?no-such-charset?B?aGk=?=');
  assert.equal(decodeWords(encodeWords('Quote for 12 Elm Rd — £1,200 ✓ '.repeat(4))), 'Quote for 12 Elm Rd — £1,200 ✓ '.repeat(4));
});

test('buildMime: no From, threading headers, and no header can be smuggled in', () => {
  const mime = buildMime({ to: ['a@x.com'], cc: ['b@x.com'], subject: 'Re: Hello', body: 'Hi\nthere', inReplyTo: '<1@x>', references: '<0@x> <1@x>' }).toString();
  assert.match(mime, /^To: a@x\.com\r\nCc: b@x\.com\r\nSubject: Re: Hello\r\nIn-Reply-To: <1@x>\r\nReferences: <0@x> <1@x>\r\nMIME-Version: 1.0\r\n/);
  assert.doesNotMatch(mime, /^From:/im);
  assert.throws(() => buildMime({ to: ['a@x.com'], subject: 'Hi\r\nBcc: evil@x.com', body: '' }));
  assert.throws(() => buildMime({ to: ['a@x.com\r\nBcc: evil@x.com'], subject: 'Hi', body: '' }));
});

test('buildMime: attachments become a multipart with safe file names', () => {
  const mime = buildMime({ to: ['a@x.com'], subject: 'Plans ✓', body: 'See attached', attachments: [{ filename: 'plan "A"\r\n.pdf', mime: 'application/pdf', content: Buffer.from('%PDF-1') }, { filename: 'x', mime: 'bad type', content: Buffer.from('1') }] }).toString();
  assert.match(mime, /Content-Type: multipart\/mixed; boundary="=_enzo_/);
  assert.match(mime, /Content-Disposition: attachment; filename="plan _A_ {2}\.pdf"/);
  assert.match(mime, /Content-Type: application\/octet-stream; name="x"/); // an invented type is not trusted
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.equal(fileParam('é.txt'), `filename="_.txt"; filename*=UTF-8''%C3%A9.txt`);
});

test('mail HTML: script, handlers, forms and javascript: links go; links open in a new tab', () => {
  const html = cleanMailHtml(
    '<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://e.com/a">ok</a></p><script>alert(1)</script><form action="/x"><input name=a></form><iframe src="https://e.com"></iframe><img src="cid:abc"><img src="https://t.example/p.gif" onerror="x()"><style>p{color:red}</style>',
  );
  assert.doesNotMatch(html, /script|onclick|onerror|javascript:|<form|<input|<iframe|cid:|<style/i);
  assert.match(html, /<a href="https:\/\/e\.com\/a" target="_blank" rel="noopener noreferrer nofollow">ok<\/a>/);
  assert.match(html, /<img src="https:\/\/t\.example\/p\.gif"/); // kept: the page's CSP decides whether it loads
});

test('collect: first bodies, named files, and an image shown by cid', () => {
  const found = collect({
    mimeType: 'multipart/mixed',
    parts: [
      { partId: '0', mimeType: 'multipart/alternative', parts: [{ partId: '0.0', mimeType: 'text/plain', body: { data: 'aGk' } }, { partId: '0.1', mimeType: 'text/html', body: { data: 'PGI-aGk8L2I-' } }] },
      { partId: '1', mimeType: 'application/pdf', filename: 'quote.pdf', body: { size: 10, attachmentId: 'ATT1' } },
      { partId: '2', mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-ID', value: '<logo>' }], body: { size: 5, attachmentId: 'ATT2' } },
    ],
  });
  assert.equal(found.text?.partId, '0.0');
  assert.equal(found.html?.partId, '0.1');
  assert.deepEqual(found.attachments.map((a) => a.part_id), ['1', '2']);
  assert.equal(found.inline_images, true);
  const message = toMessage(
    { id: 'm1', threadId: 't1', labelIds: ['UNREAD'], internalDate: '1700000000000', payload: { headers: [{ name: 'From', value: 'Jo <jo@x.com>' }, { name: 'Subject', value: '=?UTF-8?B?w4lsaXNl?=' }] } },
    { text: '', html: '<p>Hi <b>there</b></p>' },
    found,
  );
  assert.equal(message.subject, 'Élise');
  assert.equal(message.unread, true);
  assert.equal(message.text, 'Hi there'); // HTML-only mail still gets a text version
  assert.deepEqual(message.attachments[0], { part_id: '1', filename: 'quote.pdf', mime: 'application/pdf', size: 10 });
});

test('domainsOf keeps only the domain, once', () => {
  assert.deepEqual(domainsOf(['a@X.com', 'b@x.com', 'c@y.org']), ['x.com', 'y.org']);
});
