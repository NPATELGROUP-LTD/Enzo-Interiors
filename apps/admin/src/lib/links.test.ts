/**
 * Links in chat messages.
 *
 *     npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { linkHref, linkParts } from './links.ts';

test('finds http(s) and www. addresses, leaving the text around them', () => {
  assert.deepEqual(linkParts('See https://enzo.co.uk/a?b=1 and www.example.com.'), [
    'See ',
    'https://enzo.co.uk/a?b=1',
    ' and ',
    'www.example.com',
    '.',
  ]);
  assert.equal(linkHref('www.example.com'), 'https://www.example.com');
  assert.equal(linkHref('http://x.test'), 'http://x.test');
});

test('drops trailing punctuation and brackets, and ignores plain text', () => {
  assert.deepEqual(linkParts('(https://a.test/x), ok!'), ['(', 'https://a.test/x', '), ok!']);
  assert.deepEqual(linkParts('no links here, javascript:alert(1)'), ['no links here, javascript:alert(1)']);
});
