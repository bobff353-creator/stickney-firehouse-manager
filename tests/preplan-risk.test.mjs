import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  classificationLabel,
  classifyRisk,
  effectiveClassification,
  isValidRiskScore,
  isValidTargetHazardDesignation,
  riskFactorLabel,
  sortFactorsBySeverity,
  totalRiskScore,
} from "../app/preplans/risk.ts";

test("risk factor scores must be whole numbers 0 through 4", () => {
  for (const value of [0, 1, 2, 3, 4]) assert.equal(isValidRiskScore(value), true);
  assert.equal(isValidRiskScore(5), false);
  assert.equal(isValidRiskScore(-1), false);
  assert.equal(isValidRiskScore(1.5), false);
});

test("totalRiskScore sums every recorded factor's score, nothing hidden", () => {
  assert.equal(totalRiskScore([{ score: 3 }, { score: 1 }, { score: 4 }]), 8);
  assert.equal(totalRiskScore([]), 0);
});

test("classifyRisk scores against the factors actually recorded, not a fixed count", () => {
  assert.equal(classifyRisk([]), "low", "no factors recorded means no basis for elevated risk");
  assert.equal(classifyRisk([{ score: 0 }, { score: 0 }]), "low");
  assert.equal(classifyRisk([{ score: 1 }, { score: 1 }]), "moderate", "2/8 = 25%");
  assert.equal(classifyRisk([{ score: 2 }, { score: 2 }]), "high", "4/8 = 50%");
  assert.equal(classifyRisk([{ score: 3 }, { score: 3 }]), "critical", "6/8 = 75%");
  assert.equal(classifyRisk([{ score: 4 }]), "critical", "a single maxed factor still hits 100%");
});

test("classification labels are human readable", () => {
  assert.equal(classificationLabel("critical"), "Critical");
  assert.equal(classificationLabel("low"), "Low");
});

test("Scenario E — a manual officer override always wins over the computed classification", () => {
  const lowFactors = [{ score: 0 }, { score: 0 }];
  assert.equal(classifyRisk(lowFactors), "low");
  const override = { classification: "high", reviewedBy: "Chief O'Dowd", reviewedAt: "2026-08-18T00:00:00Z" };
  assert.equal(effectiveClassification(lowFactors, override), "high");
  assert.equal(effectiveClassification(lowFactors, null), "low", "no override falls back to the computed value");
});

test("a Target Hazard designation requires at least one non-blank reason (transparent, not an unexplained flag)", () => {
  assert.equal(isValidTargetHazardDesignation(["Bowstring truss roof"]), true);
  assert.equal(isValidTargetHazardDesignation([]), false);
  assert.equal(isValidTargetHazardDesignation([""]), false);
  assert.equal(isValidTargetHazardDesignation(["  ", "Propane storage on Delta side"]), true);
});

test("risk factor labels are human readable", () => {
  assert.equal(riskFactorLabel("vacancy_dangerous"), "Vacancy / Dangerous Building");
  assert.equal(riskFactorLabel("below_grade"), "Below-Grade Hazards");
});

test("factors sort most severe first for display", () => {
  const factors = [{ score: 1 }, { score: 4 }, { score: 2 }];
  assert.deepEqual(sortFactorsBySeverity(factors).map((f) => f.score), [4, 2, 1]);
});

test("bootstrap creates field_preplan_risk_factors and target-hazard columns on field_preplans", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_risk_factors/);
  assert.match(bootstrap, /UNIQUE\(preplan_id,factor_key\)/);
  assert.match(bootstrap, /ALTER TABLE field_preplans ADD COLUMN target_hazard INTEGER/);
  assert.match(bootstrap, /ALTER TABLE field_preplans ADD COLUMN target_hazard_reasons/);
  assert.match(bootstrap, /ALTER TABLE field_preplans ADD COLUMN risk_override_classification/);
});
