import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCisCadPayload } from "../app/cis-cad.ts";

test("CIS CAD adapter normalizes common JSON field names", () => {
  const result = parseCisCadPayload(JSON.stringify({
    incidentNumber: "CIS-260728-42",
    dispatchDateTime: "2026-07-28T19:45:00-05:00",
    nature: "Structure Fire",
    incidentAddress: "100 Test Street",
    municipality: "Stickney",
    assignedUnits: ["1204", "1205"],
    status: "NEW",
  }));
  assert.equal(result.ok, true);
  assert.equal(result.incident.incidentId, "CIS-260728-42");
  assert.equal(result.incident.callType, "Structure Fire");
  assert.equal(result.incident.respondingUnits, "1204, 1205");
  assert.equal(result.incident.eventType, "new");
});

test("CIS CAD adapter recognizes a cleared-call update", () => {
  const result = parseCisCadPayload([
    "Call Number: CIS-260728-42",
    "Dispatch Time: 2026-07-28T19:45:00-05:00",
    "Call Type: Fire Alarm",
    "Address: 100 Test Street",
    "Status: Cleared",
    "Time In: 2048",
  ].join("\n"), "text/plain");
  assert.equal(result.ok, true);
  assert.equal(result.incident.eventType, "close");
  assert.equal(result.incident.timeIn, "2048");
});

test("CIS CAD receiver requires authentication and keeps raw payloads out of the settings response", async () => {
  const source = await readFile(new URL("../app/api/cad/cis/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("CIS_CAD_WEBHOOK_SECRET"), true);
  assert.equal(source.includes("Invalid CIS CAD authentication."), true);
  assert.equal(source.includes("raw_payload AS"), false);
  assert.equal(source.includes("liveVerified: false"), true);
});

