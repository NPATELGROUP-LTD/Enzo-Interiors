import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TEMPLATES, blockHtml, blocksHtml, blocksOf, linkOf, type Block } from './blocks.ts';

test('text is escaped, blank lines make paragraphs, single newlines make breaks', () => {
  const html = blockHtml({ id: 'a', type: 'text', text: 'Hi <b>there</b> & you\nsecond line\n\nNext' });
  assert.equal((html.match(/<p /g) ?? []).length, 2);
  assert.ok(html.includes('Hi &lt;b&gt;there&lt;/b&gt; &amp; you<br>second line'));
  assert.ok(!html.includes('<b>'));
});

test('a button gets a working https link, and is left out with no address or label', () => {
  assert.equal(linkOf(' enzointeriors.co.uk/booking '), 'https://enzointeriors.co.uk/booking');
  assert.equal(linkOf('mailto:hello@enzo.co.uk'), 'mailto:hello@enzo.co.uk');
  assert.equal(linkOf(''), '');
  assert.ok(blockHtml({ id: 'b', type: 'button', label: 'Go', url: 'enzo.co.uk' }).includes('href="https://enzo.co.uk"'));
  assert.equal(blockHtml({ id: 'b', type: 'button', label: 'Go', url: '' }), '');
  assert.equal(blockHtml({ id: 'b', type: 'button', label: ' ', url: 'enzo.co.uk' }), '');
});

test('an attribute cannot be broken out of', () => {
  const html = blockHtml({ id: 'i', type: 'image', src: 'https://x/y.png" onerror="alert(1)', alt: '"><script>' });
  assert.ok(!html.includes('" onerror'));
  assert.ok(!html.includes('<script>'));
});

test('unfinished blocks add nothing; the templates build real emails', () => {
  assert.equal(blockHtml({ id: 'i', type: 'image', src: '', alt: '' }), '');
  assert.equal(blockHtml({ id: 'h', type: 'heading', text: '  ' }), '');
  for (const template of TEMPLATES) assert.ok(blocksHtml(template.blocks()).includes('<h2'));
});

test('saved blocks come back; an older newsletter becomes one kept-as-written block', () => {
  const saved: Block[] = [{ id: 'a', type: 'divider' }];
  assert.deepEqual(blocksOf(saved, '<p>x</p>'), saved);
  assert.deepEqual(blocksOf([{ nonsense: true }, null], '').length, 0);
  const legacy = blocksOf(null, '<p>old</p>');
  assert.equal(legacy.length, 1);
  assert.equal(blocksHtml(legacy), '<p>old</p>');
  assert.deepEqual(blocksOf(null, '  '), []);
});
