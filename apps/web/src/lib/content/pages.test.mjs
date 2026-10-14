import assert from "node:assert/strict";
import { test } from "node:test";

import { isPageOn } from "./pages.ts";

test("a missing pages setting takes the defaults; a sent value wins", () => {
  assert.equal(isPageOn({}, "about"), false);
  assert.equal(isPageOn({}, "contact"), true);
  assert.equal(isPageOn({ pages: null }, "privacy"), true);
  assert.equal(isPageOn({ pages: { about: true, contact: false } }, "about"), true);
  assert.equal(isPageOn({ pages: { about: true, contact: false } }, "contact"), false);
  assert.equal(isPageOn({ pages: { about: true } }, "booking"), false);
});
