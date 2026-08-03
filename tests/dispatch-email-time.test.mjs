import assert from "node:assert/strict";
import test from "node:test";
import { parseDispatchText } from "../app/dispatch-email.ts";

function dispatch(timestamp) {
  return parseDispatchText([
    "Incident ID: STIF-260731-1",
    "Call Type: EMS",
    "Location: 1234 Example Street",
    "City: Stickney",
    `Timestamp: ${timestamp}`,
  ].join("\n"));
}

test("BRYX timestamps without an offset are interpreted as Chicago local time", () => {
  assert.equal(dispatch("2026-07-31 01:15:00")?.dispatchedAt, "2026-07-31T06:15:00.000Z");
});

test("BRYX timestamps with an explicit offset keep that instant", () => {
  assert.equal(dispatch("2026-07-31T01:15:00-05:00")?.dispatchedAt, "2026-07-31T06:15:00.000Z");
});
