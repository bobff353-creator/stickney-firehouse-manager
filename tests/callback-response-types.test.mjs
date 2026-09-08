import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CALLBACK_QUALIFYING_CALL_TYPES, CALLBACK_RULE_VERSION, callbackTypeMatch, evaluateCallbackRules } from '../app/callback-rules.ts';

const requested = ['FIRE ALARM', 'MUTUAL AID', 'ACCIDENT WITH INJURIES', 'Auto Aid', 'MVA', 'Fire', 'STRUCTURE FIRE-ALL', 'VEHICLE FIRES', 'GAS LEAK INSIDE', 'SMELL OF SMOKE OUTDOORS', 'Mutual Aid', 'GAS ODOR OUTSIDE', 'MANPOWER CALLBACK ALERT', 'ACC W/INJ- STRUCT-FD'];
const call = {id: 'preview', logDate: '2026-09-08', timeOut: '12:01', timeIn: '12:45'};
for (const callType of requested) {
  test(`${callType} qualifies on an ordinary weekday without an override`, () => {
    const result = evaluateCallbackRules({call: {...call, callType}});
    assert.equal(result.automaticallyQualifies, true);
    assert.equal(result.matches.length, 1);
    assert.match(result.matches[0], /^Qualifying call type:/);
    assert.deepEqual(result.flags, []);
    assert.equal(result.suggestedHours, 2);
    assert.equal(result.ruleVersion, CALLBACK_RULE_VERSION);
    assert.ok(callbackTypeMatch(`  ${callType.toLowerCase().replaceAll(' ', '  ')}  `));
  });
}
test('unmarked response types do not acquire type eligibility', () => {
  for (const callType of ['EMS', 'SICK PERSON', 'FALLS', 'TREE/POLE DOWN', 'TROUBLE ALARM', 'FIRE INVESTIGATION', 'GAS', 'SMELL OF SMOKE INDOORS', '']) {
    assert.equal(evaluateCallbackRules({call: {...call, callType}}).automaticallyQualifies, false, callType);
  }
});
test('qualifying type retains duty, overlap and missing-time warnings', () => {
  const result = evaluateCallbackRules({call: {...call, callType: 'GAS LEAK INSIDE', timeIn: ''}, employeeOnDuty: true, employeeCallbackCalls: [{...call, id:'other', callType:'EMS'}]});
  assert.equal(result.automaticallyQualifies, true);
  assert.equal(result.flags.length, 3);
});
test('Daily Log options and reviewer explanation use the shared confirmed list', () => {
  assert.equal(new Set(CALLBACK_QUALIFYING_CALL_TYPES.map(type => type.toLowerCase())).size, 13);
  const daily = readFileSync(new URL('../app/daily-log.tsx', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../app/callback-reviews.tsx', import.meta.url), 'utf8');
  assert.match(daily, /\.\.\.CALLBACK_QUALIFYING_CALL_TYPES/);
  assert.match(review, /CALLBACK_QUALIFYING_CALL_TYPES\.join/);
});
