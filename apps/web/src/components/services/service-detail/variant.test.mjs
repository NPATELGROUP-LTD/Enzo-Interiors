// npm test — node's own runner; Node strips the types from variant.ts itself.
import assert from "node:assert/strict";
import { test } from "node:test";

import { variantIndex } from "./variant.ts";

test("the position cycles through the variants; a missing slug is the first", () => {
  assert.equal(variantIndex(0, 4), 0);
  assert.equal(variantIndex(5, 4), 1);
  assert.equal(variantIndex(-1, 4), 0);
});

test("an override pins the design, wrapping past the end", () => {
  assert.equal(variantIndex(2, 4, 3), 3);
  assert.equal(variantIndex(2, 4, 6), 2);
});

test("a bad override from the CMS still lands on a real variant", () => {
  assert.equal(variantIndex(2, 4, Number.NaN), 0);
  assert.equal(variantIndex(2, 4, Number.POSITIVE_INFINITY), 0);
  assert.equal(variantIndex(2, 4, 1.5), 1);
});
