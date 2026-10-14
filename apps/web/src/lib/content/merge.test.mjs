import assert from "node:assert/strict";
import { test } from "node:test";

import { withShipped } from "./merge.ts";

test("CMS copy wins; keys only src/data has fill in; arrays are never merged", () => {
  const shipped = { body: "new", added: "x", nested: { a: 1, b: 2 }, rows: [1, 2, 3] };
  const edited = { body: "client", nested: { a: 9 }, rows: [7], blank: "" };
  assert.deepEqual(withShipped(shipped, edited), {
    body: "client",
    added: "x",
    nested: { a: 9, b: 2 },
    rows: [7],
    blank: "",
  });
  assert.deepEqual(withShipped(shipped, undefined), shipped);
});
