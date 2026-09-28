// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { campaignText, cleanCampaignHtml, csvCell } from './render';

test('campaign HTML keeps its styling and loses anything that runs', () => {
  const clean = cleanCampaignHtml(
    `<h1 style="color:#102E2D;font-size:28px">New kitchens</h1>
<table role="presentation" cellpadding="0" width="100%"><tr><td bgcolor="#F2F0EB" style="padding:16px">Hi</td></tr></table>
<img src="https://media.example/k.jpg" alt="A kitchen" width="560" onerror="alert(1)">
<a href="javascript:alert(1)">bad</a><a href="https://enzo.example/book" style="color:#fff">Book</a>
<script>alert(1)</script><form action="https://evil"><input name="p"></form><iframe src="https://evil"></iframe>`,
  );
  assert.match(clean, /<h1 style="color:#102E2D;font-size:28px">/);
  assert.match(clean, /bgcolor="#F2F0EB"/);
  assert.match(clean, /<img src="https:\/\/media.example\/k.jpg" alt="A kitchen" width="560" \/>/);
  assert.match(clean, /<a href="https:\/\/enzo.example\/book" style="color:#fff">Book<\/a>/);
  assert.doesNotMatch(clean, /script|onerror|javascript:|<form|<input|<iframe/i);
});

test('the text part reads like the email, links spelled out', () => {
  const text = campaignText('<h1>Hello</h1><p>New rooms &amp; more.<br>See <a href="https://enzo.example">the site</a>.</p>');
  assert.equal(text, 'Hello\n\nNew rooms & more.\nSee the site (https://enzo.example).');
});

test('CSV cells are quoted and never start a formula', () => {
  assert.equal(csvCell('a@b.co'), '"a@b.co"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell(null), '""');
});
