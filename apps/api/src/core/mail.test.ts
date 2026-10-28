import assert from 'node:assert/strict';
import { test } from 'node:test';

import { templates } from './mail.service';

test('a reply keeps its line breaks without relying on white-space:pre-wrap, which Outlook ignores', () => {
  const { html, text } = templates.enquiryReply('Ann Lee', 'First line\nSecond line\n\nNew paragraph <b>not bold</b>');
  assert.ok(!html.includes('pre-wrap'));
  assert.ok(html.includes('First line<br>Second line</p>'), 'a single newline is a <br>');
  assert.ok(html.includes('<p style="margin:0 0 16px">New paragraph &lt;b&gt;not bold&lt;/b&gt;</p>'), 'a blank line starts a paragraph, and markup is escaped');
  assert.ok(text.includes('First line\nSecond line\n\nNew paragraph'), 'the plain-text part is untouched');
});
