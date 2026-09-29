import test from "node:test";
import assert from "node:assert/strict";
import { groupResponseTypes, isEmsResponseType } from "../app/response-type-groups.ts";

test("groups the department's medical dispatch labels, including stroke, as EMS", () => {
  const labels = [
    "SICK PERSON", "EMS", "FALLS", "LIFT ASSIST", "PSYCH/AB BEH/SUICIDE ATT",
    "UNCONSCIOUS/FAINTING", "OVERDOSE ALCOHOL", "CONVULSIONS/SEIZURES", "BREATHING PROBLEMS",
    "ASSAULT/SEX ASLT/TAZER FD", "HEMORRHAGE / LACERATIONS", "MEDICAL ALARM",
    "CHEST PAIN (NON-TRAUMA)", "TRAUMATIC INJ", "UNK MEDICAL", "CARDIAC/RESP ARREST/DEATH",
    "STROKE (CVA/TIA)", "DIABETIC PROBLEMS", "ANIMAL BITE/ATTACK (FD)", "PD ASSIST FD/AMBULANCE",
    "BACK PAIN (NON-TRAUMA)", "OVERDOSE DRUGS/MEDICATION", "PSYCH EVALUATION", "STAB/GUNSHOT (FD)",
    "CHOKING", "HEART PROBLEMS", "HEADACHE", "ABDOMINAL PAIN", "PANIC/HOLD UP ALARM",
  ];
  for (const label of labels) assert.ok(isEmsResponseType(label), label);
  const result = groupResponseTypes(labels.map((label) => [label, 1]));
  assert.deepEqual(result.summary, [["EMS", labels.length]]);
  assert.equal(result.breakdown.length, labels.length);
});

test("accepts punctuation and case variants without matching unrelated calls", () => {
  for (const label of [" sick person ", "Hemorrhage/Lacerations", "Stab / Gunshot (FD)", "headach", "chking", "Psych/AB BEH/Suicide Att"]) {
    assert.ok(isEmsResponseType(label), label);
  }
  for (const label of ["FIRE ALARM", "MVA", "ACCIDENT WITH INJURIES", "PD ASSIST", "CARBON MONOXIDE", "EMS STANDBY", "NON-EMS", "MUTUAL AID", "UNKNOWN", ""]) {
    assert.equal(isEmsResponseType(label), false, label);
  }
});

test("counts each call once and retains the original dispatch labels in the breakdown", () => {
  const input = Object.freeze([
    Object.freeze(["EMS", 4]), Object.freeze(["SICK PERSON", 5]), Object.freeze(["SICK PERSON", 2]),
    Object.freeze(["Stab/Gunshot (FD)", 1]), Object.freeze(["FIRE ALARM", 3]), Object.freeze(["MVA", 2]), Object.freeze(["PANIC/HOLD UP ALARM", 1]),
  ]);
  const result = groupResponseTypes(input);
  assert.deepEqual(result.summary, [["EMS", 13], ["FIRE ALARM", 3], ["MVA", 2]]);
  assert.deepEqual(result.breakdown, [["SICK PERSON", 7], ["EMS", 4], ["PANIC/HOLD UP ALARM", 1], ["Stab/Gunshot (FD)", 1]]);
  assert.equal(result.total, 18);
  assert.equal(result.summary.reduce((sum, [, count]) => sum + count, 0), result.total);
  assert.equal(result.breakdown.reduce((sum, [, count]) => sum + count, 0), result.emsTotal);
  assert.equal(input.length, 7);
});

test("does not invent an EMS category in an empty or nonmedical range", () => {
  assert.deepEqual(groupResponseTypes([]), { summary: [], breakdown: [], emsTotal: 0, total: 0 });
  assert.deepEqual(groupResponseTypes([["FIRE ALARM", 3]]), {
    summary: [["FIRE ALARM", 3]], breakdown: [], emsTotal: 0, total: 3,
  });
});
