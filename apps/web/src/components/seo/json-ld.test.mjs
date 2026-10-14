// npm test — node's own runner; Node strips the types from json-ld.ts itself.
import assert from "node:assert/strict";
import { test } from "node:test";

import { jsonLdString } from "./json-ld.ts";

test("a value cannot close the script tag, and the JSON still reads back the same", () => {
  const data = {
    name: "</script><script>alert(1)</script>",
    note: "<!-- hi -->",
    line: "a\u2028b\u2029c",
  };
  const out = jsonLdString(data);

  assert.ok(!out.includes("<"), "no literal < left in the output");
  assert.ok(out.includes("\\u003c/script>"), "the escape is the six characters \\u003c");
  assert.ok(!out.includes("\u2028") && !out.includes("\u2029"), "no raw line separators");
  assert.deepEqual(JSON.parse(out), data);
});

test("arrays and plain values pass through unchanged", () => {
  assert.equal(jsonLdString([{ a: 1 }, { b: "x" }]), '[{"a":1},{"b":"x"}]');
});
