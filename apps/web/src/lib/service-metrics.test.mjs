// npm test — node's own runner; Node strips the types from service-metrics.ts itself.
import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePriceLabel } from "./service-metrics.ts";

test("a price label reads as its first figure, commas and all", () => {
  assert.equal(parsePriceLabel("£4,500"), 4500);
  assert.equal(parsePriceLabel("From £1,250.50"), 1250.5);
});

test("a range is its lower figure, not the digits run together", () => {
  assert.equal(parsePriceLabel("£4,500 - £6,000"), 4500);
});

test("a label with no number is null", () => {
  assert.equal(parsePriceLabel("On request"), null);
  assert.equal(parsePriceLabel(""), null);
});
