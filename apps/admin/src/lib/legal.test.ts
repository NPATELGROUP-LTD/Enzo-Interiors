/**
 * The admin's Privacy, Terms and Cookies pages.
 *
 *     npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMPANY, LEGAL, LEGAL_KINDS, legalKind } from './legal.ts';

test('legalKind finds the three addresses, with or without a trailing slash', () => {
  assert.equal(legalKind('/privacy'), 'privacy');
  assert.equal(legalKind('/terms/'), 'terms');
  assert.equal(legalKind('/cookies'), 'cookies');
  assert.equal(legalKind('/'), null);
  assert.equal(legalKind('/privacy/extra'), null);
  assert.equal(legalKind('/clients'), null);
});

test('every document has unique clause ids, text, and no unfilled placeholder', () => {
  for (const kind of LEGAL_KINDS) {
    const doc = LEGAL[kind];
    const ids = doc.clauses.map((clause) => clause.id);
    assert.equal(new Set(ids).size, ids.length, `${kind}: clause ids repeat`);
    assert.ok(doc.title && doc.intro, `${kind}: title and intro`);
    for (const clause of doc.clauses) assert.ok(clause.body.length > 0, `${kind}/${clause.id}: empty`);
    assert.doesNotMatch(JSON.stringify(doc), /\[[A-Z ]{3,}\]/, `${kind}: placeholder left in`);
  }
});

test('the controller is named in full, with its real ICO number and no invented VAT number', () => {
  const all = JSON.stringify(LEGAL);
  assert.ok(all.includes(COMPANY.name) && all.includes(COMPANY.number) && all.includes(COMPANY.address));
  assert.ok(all.includes(COMPANY.privacyEmail));
  assert.ok(all.includes('ZC047912'));
  assert.doesNotMatch(all, /VAT (registration )?number/i);
});
