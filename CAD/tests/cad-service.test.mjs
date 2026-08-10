import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOutboundEnvelope,
  haversineMeters,
  isDeliverableUrl,
  isValidLatLng,
  metersToMiles,
  normalizeAlarmSignal,
  normalizeIncidentNote,
  normalizeVehicleLocation,
  parseSubscriptions,
  rankUnitsByProximity,
  signPayload,
  verifyInboundSignature,
} from "../lib/cad-service.ts";

test("haversine distance is accurate between two known points", () => {
  // Stickney FD area to downtown Chicago is roughly 14 km.
  const meters = haversineMeters(41.8228, -87.7834, 41.8781, -87.6298);
  assert.ok(meters > 13000 && meters < 15000, `expected ~14km, got ${meters}`);
  assert.ok(Math.abs(metersToMiles(1609.344) - 1) < 1e-9);
});

test("closest-unit ranking puts the nearest dispatchable unit first", () => {
  const target = { latitude: 41.8228, longitude: -87.7834 };
  const units = [
    { unitId: "a", unitNumber: "1201", name: "Engine", unitType: "engine", agency: "Stickney", status: "available", latitude: 41.9, longitude: -87.79, locationAt: "", activeIncidentId: "" },
    { unitId: "b", unitNumber: "1204", name: "Engine", unitType: "engine", agency: "Stickney", status: "available", latitude: 41.825, longitude: -87.784, locationAt: "", activeIncidentId: "" },
    { unitId: "c", unitNumber: "1205", name: "Truck", unitType: "truck", agency: "Stickney", status: "onscene", latitude: 41.823, longitude: -87.783, locationAt: "", activeIncidentId: "INC-1" },
    { unitId: "d", unitNumber: "1209", name: "Squad", unitType: "squad", agency: "Stickney", status: "available", latitude: null, longitude: null, locationAt: "", activeIncidentId: "" },
  ];
  const ranked = rankUnitsByProximity(units, target);
  assert.equal(ranked[0].unitNumber, "1204", "nearest available unit first");
  assert.equal(ranked[0].dispatchable, true);
  // The committed on-scene unit (closest by distance) must not outrank available units.
  assert.equal(ranked.at(-1).unitNumber, "1205", "committed unit sorts last behind the no-GPS available unit");
  assert.equal(ranked.at(-1).dispatchable, false);
});

test("vehicle location normalizer accepts varied field names and rejects junk", () => {
  const ok = normalizeVehicleLocation({ unit: "1204", lat: 41.82, lon: -87.78, heading: 90, speed: 34, status: "en-route" });
  assert.equal(ok.ok, true);
  assert.equal(ok.ping.unitNumber, "1204");
  assert.equal(ok.ping.status, "enroute");
  assert.equal(ok.ping.heading, 90);

  assert.equal(normalizeVehicleLocation({ lat: 41.8, lon: -87.7 }).ok, false, "missing unit id");
  assert.equal(normalizeVehicleLocation({ unit: "1204", lat: 0, lon: 0 }).ok, false, "null island rejected");
  assert.equal(isValidLatLng(91, 10), false);
  assert.equal(isValidLatLng(41.8, -87.7), true);
});

test("incident note normalizer keeps timestamps and defaults the category", () => {
  const result = normalizeIncidentNote({ incidentNumber: "INC-9", text: "Working fire, second alarm", type: "size_up", at: "2026-08-10T14:30:00Z", id: "abc" });
  assert.equal(result.ok, true);
  assert.equal(result.note.incidentId, "INC-9");
  assert.equal(result.note.category, "size_up");
  assert.equal(result.note.externalId, "abc");
  assert.equal(result.note.eventAt, "2026-08-10T14:30:00.000Z");

  const fallback = normalizeIncidentNote({ incidentId: "INC-9", note: "x", category: "unknown-cat" });
  assert.equal(fallback.note.category, "note");
  assert.equal(normalizeIncidentNote({ note: "no incident" }).ok, false);
});

test("alarm signal normalizer classifies signal type and priority", () => {
  const alarm = normalizeAlarmSignal({ type: "ALARM", zone: "3", description: "Waterflow", eventId: "e1" });
  assert.equal(alarm.ok, true);
  assert.equal(alarm.signal.signalType, "alarm");
  assert.equal(alarm.signal.priority, "critical");
  const trouble = normalizeAlarmSignal({ signalType: "trouble", message: "Low battery" });
  assert.equal(trouble.signal.signalType, "trouble");
  assert.equal(trouble.signal.priority, "high");
});

test("subscription parsing accepts arrays, JSON, and CSV, dropping invalid events", () => {
  assert.deepEqual(parseSubscriptions(["note", "bogus", "alarm"]), ["note", "alarm"]);
  assert.deepEqual(parseSubscriptions('["incident","status"]'), ["incident", "status"]);
  assert.deepEqual(parseSubscriptions("location, note"), ["location", "note"]);
  assert.deepEqual(parseSubscriptions(null), []);
});

test("outbound URLs must be absolute http(s)", () => {
  assert.equal(isDeliverableUrl("https://partner.example/cad"), true);
  assert.equal(isDeliverableUrl("http://10.0.0.4:8080/in"), true);
  assert.equal(isDeliverableUrl("ftp://x"), false);
  assert.equal(isDeliverableUrl("not a url"), false);
});

test("HMAC signing round-trips through the inbound verifier", async () => {
  const secret = "shared-cad-secret";
  const envelope = buildOutboundEnvelope("note", { incidentId: "INC-1", note: "test" });
  const body = JSON.stringify(envelope);
  const signature = await signPayload(secret, body);

  assert.equal(await verifyInboundSignature({ authorization: "", signature: `sha256=${signature}` }, body, secret), true);
  assert.equal(await verifyInboundSignature({ authorization: "Bearer shared-cad-secret", signature: "" }, body, secret), true);
  assert.equal(await verifyInboundSignature({ authorization: "", signature: `sha256=${signature}` }, body + "tamper", secret), false, "tampered body fails");
  assert.equal(await verifyInboundSignature({ authorization: "", signature: `sha256=${signature}` }, body, ""), false, "empty secret fails");
});
