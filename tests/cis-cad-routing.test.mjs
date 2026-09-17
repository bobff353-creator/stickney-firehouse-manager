import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCisCadPayload } from '../app/cis-cad.ts';
import { defaultCisSettings, validateCisSettings, reduceCisEvent } from '../app/cis-cad-routing.ts';
const settings = validateCisSettings({ ...defaultCisSettings(), mode: 'shadow', agencies: ['FIXTURE'], units: [{ agency: 'FIXTURE', external: 'T1204', apparatus: '1204' }, { agency: 'FIXTURE', external: 'A1205', apparatus: '1205' }] }, ['1204', '1205']);
const parse = raw => { const result = parseCisCadPayload(JSON.stringify(raw)); assert.equal(result.ok, true, result.error); return result.incident; };
const original = { incidentNumber: 'TEST-ONLY', agency: 'FIXTURE', dispatchDateTime: '2026-09-16T09:00:00-05:00', eventTimestamp: '2026-09-16T09:00:00-05:00', sequence: 1, status: 'new', nature: 'EMS mutual aid', address: 'Preview only, outside town', city: 'Other city', notes: 'Initial notes', assignedUnits: ['T1204', 'A1205', 'OTHER1204'] };
const initial = () => reduceCisEvent(null, parse(original), settings).state;
test('CIS defaults disabled, mappings are exact and Fleet/agency validated', () => {
  assert.equal(defaultCisSettings().mode, 'disabled');
  for (const units of [[{ agency: 'OTHER', external: 'E1', apparatus: '1204' }], [{ agency: 'FIXTURE', external: 'E1', apparatus: '9999' }], [settings.units[0], settings.units[0]]]) assert.throws(() => validateCisSettings({ ...settings, units }, ['1204']));
  assert.deepEqual(initial().mappedUnits, ['1204', '1205']);
  assert.deepEqual(initial().unmappedUnits, ['OTHER1204']);
  assert.equal(reduceCisEvent(null, parse({ ...original, agency: 'OTHER' }), settings).status, 'rejected');
  assert.equal(initial().callType, 'EMS mutual aid', 'No fire-only or in-town filter');
});
test('blank coordinates stay null; offset-less new incident timestamps are rejected', () => {
  assert.equal(parse({ ...original, latitude: '', longitude: '' }).latitude, null);
  assert.equal(parseCisCadPayload(JSON.stringify({ ...original, dispatchDateTime: '2026-09-16T09:00:00' })).ok, false);
  assert.equal(reduceCisEvent(null, parse({ ...original, latitude: 400, longitude: 600 }), settings).state.latitude, null);
});
test('partial notes retain address, original dispatch time and both rigs', () => {
  const update = parse({ incidentNumber: 'TEST-ONLY', status: 'update', sequence: 2, notes: 'New notes' });
  const result = reduceCisEvent(initial(), update, settings);
  assert.equal(result.status, 'applied');
  assert.equal(result.state.address, original.address);
  assert.equal(result.state.narrative, 'New notes');
  assert.equal(result.state.respondingUnits, '1204, 1205');
});
test('unit available removes only that rig; timeIn alone never closes incident', () => {
  const unit = parse({ incidentNumber: 'TEST-ONLY', status: 'unit available', unitId: 'T1204', timeIn: '1030', sequence: 2 });
  assert.equal(unit.eventType, 'update');
  const result = reduceCisEvent(initial(), unit, settings).state;
  assert.equal(result.closed, false); assert.equal(result.respondingUnits, '1205'); assert.equal(result.timeIn, '');
  assert.notEqual(parse({ ...original, status: 'update', timeIn: '1030' }).eventType, 'close');
});
test('explicit empty unit snapshot clears assignments; omitted list preserves them', () => {
  const result = reduceCisEvent(initial(), parse({ incidentNumber: 'TEST-ONLY', status: 'update', sequence: 2, assignedUnits: [] }), settings).state;
  assert.deepEqual(result.mappedUnits, []);
});
test('older events and updates after incident close cannot resurrect calls', () => {
  assert.equal(reduceCisEvent(initial(), parse({ ...original, sequence: 0 }), settings).status, 'ignored');
  const close = reduceCisEvent(initial(), parse({ incidentNumber: 'TEST-ONLY', incidentStatus: 'closed', sequence: 3, timeIn: '1045' }), settings).state;
  assert.equal(close.closed, true);
  assert.equal(reduceCisEvent(close, parse({ ...original, sequence: 4 }), settings).status, 'ignored');
  assert.equal(reduceCisEvent(initial(), parse({ ...original, sequence: null, status: 'update' }), settings).status, 'rejected');
});
test('timestamp ordered incidents reject stale notes and require a timestamp on updates', () => {
  const base = reduceCisEvent(null, parse({ ...original, sequence: null }), settings).state;
  assert.equal(reduceCisEvent(base, parse({ ...original, sequence: null, status: 'update' }), settings).status, 'ignored');
  assert.equal(reduceCisEvent(base, parse({ incidentId: 'TEST-ONLY', status: 'update', notes: 'No clock' }), settings).status, 'rejected');
  assert.equal(reduceCisEvent(base, parse({ incidentId: 'TEST-ONLY', status: 'update', notes: 'Later', eventAt: '2026-09-16T15:00:00Z' }), settings).status, 'applied');
});
