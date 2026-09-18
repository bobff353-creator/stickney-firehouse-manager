import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCisCadPayload } from '../app/cis-cad.ts';
import { defaultCisSettings, validateCisSettings, reduceCisEvent } from '../app/cis-cad-routing.ts';
import { projectFleet, renderApparatusRow } from './helpers/board-apparatus-render.mjs';

const fleet = [
  { unitNumber: '1203', name: 'Fixture engine', status: 'in_service' },
  { unitNumber: '1205', name: 'Fixture ambulance', status: 'in_service' },
  { unitNumber: '1204', name: 'Fixture truck', status: 'out_of_service' },
];
const call = respondingUnits => ({ respondingUnits });

test('bottom apparatus row shows active units in red while preserving Fleet statuses', () => {
  const before = structuredClone(fleet);
  const apparatus = projectFleet(fleet, [call('1203, 1205')]);
  assert.deepEqual(apparatus.map(unit => unit.status), ['Committed to call', 'Committed to call', 'Out of service']);
  const html = renderApparatusRow({ apparatus });
  assert.match(html, /class="committed"><b>Unit 1203<\/b><span>Committed to call/);
  assert.match(html, /class="unknown"><b>Unit 1204<\/b><span>Out of service/);
  assert.equal((html.match(/<b>Unit /g) ?? []).length, fleet.length);
  assert.deepEqual(fleet, before);
});

test('department-only labels and unmapped or partial IDs cannot assign a rig', () => {
  for (const units of ['STIF', '', '12030', 'OTHER1203', 'E1203']) {
    assert.equal(projectFleet(fleet, [call(units)])[0].status, 'Available', units);
  }
  assert.equal(projectFleet(fleet, [call('1203'), call('1205')])[0].status, 'Committed to call');
  assert.equal(projectFleet(fleet, [call('1205')])[0].status, 'Available');
  assert.equal(projectFleet(fleet, [call('1203'), call('1203')])[0].status, 'Committed to call');
  assert.equal(projectFleet(fleet, [])[2].status, 'Out of service');
});

test('mapped CIS dispatch, unit clear, and incident close flow into the actual board row', () => {
  const settings = validateCisSettings({ ...defaultCisSettings(), mode: 'shadow', agencies: ['FIXTURE'], units: [
    { agency: 'FIXTURE', external: 'E1203', apparatus: '1203' },
    { agency: 'FIXTURE', external: 'A1205', apparatus: '1205' },
  ] }, ['1203', '1205']);
  const event = raw => {
    const parsed = parseCisCadPayload(JSON.stringify({ incidentNumber: 'FIXTURE-ONLY', ...raw }));
    assert.equal(parsed.ok, true, parsed.error);
    return parsed.incident;
  };
  let incident = reduceCisEvent(null, event({ agency: 'FIXTURE', dispatchDateTime: '2026-09-18T09:00:00-05:00', sequence: 1, status: 'new', nature: 'Fixture', address: 'Local test only', assignedUnits: ['E1203', 'A1205'] }), settings).state;
  const statuses = () => projectFleet(fleet, incident.closed ? [] : [incident]).map(unit => unit.status);
  assert.deepEqual(statuses(), ['Committed to call', 'Committed to call', 'Out of service']);
  incident = reduceCisEvent(incident, event({ status: 'unit available', unitId: 'E1203', sequence: 2 }), settings).state;
  assert.deepEqual(statuses(), ['Available', 'Committed to call', 'Out of service']);
  incident = reduceCisEvent(incident, event({ incidentStatus: 'closed', sequence: 3, timeIn: '1045' }), settings).state;
  assert.deepEqual(statuses(), ['Available', 'Available', 'Out of service']);
  assert.match(renderApparatusRow({ apparatus: projectFleet(fleet, []), feedDegraded: true }), /Last confirmed information · update delayed/);
});
