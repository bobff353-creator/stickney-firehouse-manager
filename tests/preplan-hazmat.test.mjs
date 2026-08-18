import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  containerLabel,
  hazmatSummaryLine,
  highestNfpaRating,
  isValidNfpaRating,
  isValidUnNaNumber,
  isVerificationStale,
  normalizeUnNaNumber,
  physicalStateLabel,
  sortHazmatBySeverity,
} from "../app/preplans/hazmat.ts";

function makeRecord(overrides = {}) {
  return {
    id: "hz-1", preplanId: "preplan-1", levelId: null, mapped: true,
    chemicalName: "Chlorine", unNaNumber: "UN1017", ergGuideNumber: "124",
    quantity: 150, quantityUnit: "lb", containerType: "cylinder", physicalState: "gas",
    exactLocation: "Delta-side mechanical room", nfpaHealth: 3, nfpaFlammability: 0, nfpaInstability: 0, nfpaSpecial: "",
    sdsAssetId: null, photoAssetId: null, dateVerified: "2026-06-01", verifiedBy: "Capt. Jones",
    effectiveAt: null, expiresAt: null, notes: "", createdBy: "system", updatedBy: "system",
    ...overrides,
  };
}

test("NFPA 704 ratings must be whole numbers 0 through 4", () => {
  for (const value of [0, 1, 2, 3, 4]) assert.equal(isValidNfpaRating(value), true);
  assert.equal(isValidNfpaRating(5), false);
  assert.equal(isValidNfpaRating(-1), false);
  assert.equal(isValidNfpaRating(2.5), false);
});

test("UN/NA numbers must match the UN#### or NA#### pattern", () => {
  assert.equal(isValidUnNaNumber("UN1017"), true);
  assert.equal(isValidUnNaNumber("NA9191"), true);
  assert.equal(isValidUnNaNumber("un1017"), true, "case insensitive");
  assert.equal(isValidUnNaNumber("1017"), false);
  assert.equal(isValidUnNaNumber("UN17"), false);
  assert.equal(isValidUnNaNumber(""), false);
});

test("normalizeUnNaNumber upcases and strips whitespace from a valid number", () => {
  assert.equal(normalizeUnNaNumber(" un1017 "), "UN1017");
  assert.equal(normalizeUnNaNumber("na 9191"), "NA9191");
});

test("a record with no verification date, or one older than the staleness window, needs re-verification", () => {
  const now = new Date("2026-08-18T00:00:00Z");
  assert.equal(isVerificationStale(null, now), true);
  assert.equal(isVerificationStale("2025-01-01T00:00:00Z", now), true, "older than 365 days");
  assert.equal(isVerificationStale("2026-08-01T00:00:00Z", now), false, "recent");
  assert.equal(isVerificationStale("not-a-date", now), true);
});

test("highestNfpaRating picks the most severe of health/flammability/instability", () => {
  assert.equal(highestNfpaRating({ nfpaHealth: 3, nfpaFlammability: 1, nfpaInstability: 0 }), 3);
  assert.equal(highestNfpaRating({ nfpaHealth: 0, nfpaFlammability: 0, nfpaInstability: 4 }), 4);
});

test("HazMat records sort with the most severe NFPA rating first", () => {
  const records = [
    makeRecord({ id: "low", nfpaHealth: 1, nfpaFlammability: 0, nfpaInstability: 0 }),
    makeRecord({ id: "high", nfpaHealth: 4, nfpaFlammability: 0, nfpaInstability: 0 }),
    makeRecord({ id: "mid", nfpaHealth: 2, nfpaFlammability: 2, nfpaInstability: 0 }),
  ];
  const sorted = sortHazmatBySeverity(records);
  assert.deepEqual(sorted.map((r) => r.id), ["high", "mid", "low"]);
});

test("container and physical state labels are human readable", () => {
  assert.equal(containerLabel("cylinder"), "Cylinder");
  assert.equal(physicalStateLabel("cryogenic"), "Cryogenic");
});

test("hazmatSummaryLine never fabricates data — only reports what's entered", () => {
  const line = hazmatSummaryLine(makeRecord());
  assert.equal(line, "UN1017 · ERG 124 · 150 lb · Cylinder");
  const sparse = hazmatSummaryLine({ unNaNumber: "", ergGuideNumber: "", quantity: null, quantityUnit: "", containerType: "other" });
  assert.equal(sparse, "Other", "no fields entered means nothing is fabricated to fill the gap");
});

test("bootstrap creates the field_preplan_hazmat table with NFPA and UN/NA columns", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_hazmat/);
  assert.match(bootstrap, /un_na_number TEXT NOT NULL DEFAULT ''/);
  assert.match(bootstrap, /nfpa_health INTEGER NOT NULL DEFAULT 0/);
  assert.match(bootstrap, /field_preplan_hazmat_preplan_idx/);
});
