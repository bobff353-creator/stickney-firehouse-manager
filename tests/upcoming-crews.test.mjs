import test from 'node:test';
import assert from 'node:assert/strict';
import { nextThreeDepartmentShifts } from '../app/department-schedule.ts';
const member = { id: 'a', employeeId: 'e1', employeeName: 'Preview member', workDate: '2026-09-08', startTime: '06:00', endTime: '06:00', role: 'Firefighter', status: 'assigned' };
test('10:44 shows noon, overnight, then tomorrow morning, including unfilled slots', () => {
  const shifts = nextThreeDepartmentShifts([member], '2026-09-08', 644);
  assert.deepEqual(shifts.map(s => [s.workDate, s.startTime, s.endDate, s.endTime]), [
    ['2026-09-08', '12:00', '2026-09-08', '18:00'],
    ['2026-09-08', '18:00', '2026-09-09', '06:00'],
    ['2026-09-09', '06:00', '2026-09-09', '12:00'],
  ]);
  assert.deepEqual(shifts.map(s => s.items.length), [1, 1, 0]);
  assert.equal(shifts[0].items[0].startTime, '12:00');
  assert.equal(shifts[1].items[0].endDate, '2026-09-09');
});
test('at each boundary the current shift drops out, and late night includes all tomorrow slots', () => {
  for (const [minute, starts] of [[359,['06:00','12:00','18:00']], [360,['12:00','18:00','06:00']], [720,['18:00','06:00','12:00']], [1080,['06:00','12:00','18:00']], [1439,['06:00','12:00','18:00']]]) {
    assert.deepEqual(nextThreeDepartmentShifts([], '2026-09-08', minute).map(s => s.startTime), starts);
  }
});
test('partial shifts are clipped to each slot and canceled/unassigned shifts are excluded', () => {
  const shifts = nextThreeDepartmentShifts([
    {...member, startTime:'14:00',endTime:'20:00'},
    {...member,id:'cancelled',status:'cancelled'},
    {...member,id:'open',employeeId:null},
  ], '2026-09-08',644);
  assert.deepEqual(shifts.map(s=>s.items.map(i=>[i.startTime,i.endTime])), [[['14:00','18:00']],[['18:00','20:00']],[]]);
});
test('calendar slots survive DST and year rollover', () => {
  assert.equal(nextThreeDepartmentShifts([], '2026-12-31', 1300)[0].workDate, '2027-01-01');
  assert.deepEqual(nextThreeDepartmentShifts([], '2026-11-01', 60).map(s=>s.startTime), ['06:00','12:00','18:00']);
});
test('duplicate assignments do not duplicate a member, and large crews are not truncated by the API', () => {
  const crew = Array.from({length:9},(_,i)=>({...member,id:`id${i}`,employeeId:`e${i}`}));
  assert.equal(nextThreeDepartmentShifts([...crew,crew[0]], '2026-09-08',644)[0].items.length, 9);
});
test('third crew includes assignments later than the old 24-hour cutoff', () => {
  const shifts = nextThreeDepartmentShifts([{...member,workDate:'2026-09-09',startTime:'11:00',endTime:'12:00'}], '2026-09-08',644);
  assert.deepEqual(shifts.map(s=>s.items.length), [0,0,1]);
});
