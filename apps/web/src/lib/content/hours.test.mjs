// npm test — node's own runner; Node strips the types from hours.ts itself.
import assert from "node:assert/strict";
import { test } from "node:test";

import { hoursRows } from "./hours.ts";

const ten = [{ open: "10:00", close: "17:00" }];

test("same hours fold into one row; a day's note keeps it on its own", () => {
  const rows = hoursRows(
    {
      weekly: {
        tuesday: ten,
        wednesday: ten,
        thursday: ten,
        friday: [{ open: "10:00", close: "12:30" }, { open: "14:30", close: "17:00" }],
        saturday: ten,
      },
      notes: { saturday: "Late opening in December", sunday: "  " },
      note: "",
    },
    "Closed",
  );
  assert.deepEqual(rows, [
    { day: "Monday", time: "Closed" },
    { day: "Tuesday – Thursday", time: "10:00 – 17:00" },
    { day: "Friday", time: "10:00 – 12:30, 14:30 – 17:00" },
    { day: "Saturday", time: "10:00 – 17:00", note: "Late opening in December" },
    { day: "Sunday", time: "Closed" },
  ]);
});

test("a noted day does not swallow the next one with the same hours", () => {
  const rows = hoursRows({ weekly: { monday: ten, tuesday: ten }, notes: { monday: "Phones only" }, note: "" }, "Shut");
  assert.deepEqual(rows.slice(0, 3), [
    { day: "Monday", time: "10:00 – 17:00", note: "Phones only" },
    { day: "Tuesday", time: "10:00 – 17:00" },
    { day: "Wednesday – Sunday", time: "Shut" },
  ]);
});
