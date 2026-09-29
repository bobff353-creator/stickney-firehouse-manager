/** Department-requested display grouping. Original dispatch labels remain unchanged. */
const emsLabels = [
  "EMS", "SICK", "SICK PERSON", "FALL", "FALLS", "LIFT ASSIST",
  "PSYCH/AB BEH/SUICIDE ATT", "PSYCH/ABN BEH/SUICIDE ATT", "PSYCH/ABNORMAL BEHAVIOR/SUICIDE ATTEMPT",
  "UNCONSCIOUS/FAINTING", "OVERDOSE ALCOHOL", "CONVULSIONS/SEIZURES", "BREATHING PROBLEMS",
  "ASSAULT/SEX ASLT/TAZER", "ASSAULT/SEX ASLT/TASER", "HEMORRHAGE/LACERATIONS", "MEDICAL ALARM",
  "CHEST PAIN (NON-TRAUMA)", "TRAUMATIC INJ", "TRAUMATIC INJURY", "TRAUMATIC INJURIES",
  "UNK MEDICAL", "UNKNOWN MEDICAL", "CARDIAC/RESP ARREST/DEATH", "CARDIAC/RESPIRATORY ARREST/DEATH",
  "STROKE (CVA/TIA)", "STROKE", "DIABETIC PROBLEMS", "ANIMAL BITE/ATTACK", "PD ASSIST FD/AMBULANCE", "BACK PAIN (NON-TRAUMA)",
  "OVERDOSE DRUGS/MEDICATION", "OVERDOSE DRUGS/MEDICATIONS", "PSYCH EVALUATION", "STAB/GUNSHOT",
  "CHOKING", "CHKING", "HEART PROBLEMS", "HEADACHE", "HEADACH", "ABDOMINAL PAIN",
];
const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/FD$/, "");
const emsKeys = new Set(emsLabels.map(normalize));

export function isEmsResponseType(label: string) {
  return emsKeys.has(normalize(label));
}

export type ResponseTypeCount = readonly [label: string, count: number];
export function groupResponseTypes(types: readonly ResponseTypeCount[]) {
  const ems = new Map<string, number>();
  const other = new Map<string, number>();
  for (const [label, count] of types) {
    const destination = isEmsResponseType(label) ? ems : other;
    destination.set(label, (destination.get(label) ?? 0) + count);
  }
  const compare = (a: ResponseTypeCount, b: ResponseTypeCount) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const breakdown = [...ems.entries()].sort(compare);
  const emsTotal = breakdown.reduce((total, [, count]) => total + count, 0);
  const summary: ResponseTypeCount[] = [...other.entries()];
  if (breakdown.length) summary.push(["EMS", emsTotal]);
  summary.sort(compare);
  return { summary, breakdown, emsTotal, total: types.reduce((total, [, count]) => total + count, 0) };
}
