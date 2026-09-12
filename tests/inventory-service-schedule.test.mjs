import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addServiceMonths, serviceDates, serviceScheduleInput, serviceReminders, serviceToday } from '../app/inventory-service-schedule.ts';
const scheduled = (changes={}) => ({last_serviced_date:'2025-12-31',service_interval_months:12,service_reminder_months:3,...changes});

test('calendar intervals cover requested presets, month ends, and leap years',()=>{
 for(const [date,months,want] of [['2024-02-29',12,'2025-02-28'],['2024-08-31',18,'2026-02-28'],['2024-02-29',24,'2026-02-28'],['2024-02-29',36,'2027-02-28'],['2024-02-29',60,'2029-02-28'],['2026-01-31',1,'2026-02-28'],['2026-12-31',-4,'2026-08-31']]) assert.equal(addServiceMonths(date,months),want);
});
test('reminder starts on chosen date and persists through due and overdue',()=>{
 assert.deepEqual(serviceDates(scheduled(),'2026-09-29'),{due:'2026-12-31',reminder:'2026-09-30',status:'upcoming'});
 assert.equal(serviceDates(scheduled(),'2026-09-30').status,'schedule');
 assert.equal(serviceDates(scheduled(),'2026-12-31').status,'due');
 assert.equal(serviceDates(scheduled(),'2027-01-01').status,'overdue');
 for(const months of [2,3,4]) assert.equal(serviceDates(scheduled({service_reminder_months:months}),'2026-09-01').reminder,addServiceMonths('2026-12-31',-months));
});
test('Chicago rollover and DST boundaries do not shift the saved day',()=>{
 assert.equal(serviceToday(new Date('2026-09-12T04:59:59Z')),'2026-09-11');
 assert.equal(serviceToday(new Date('2026-09-12T05:00:00Z')),'2026-09-12');
 assert.equal(serviceToday(new Date('2026-11-01T06:59:59Z')),'2026-11-01');
 assert.equal(serviceToday(new Date('2026-11-01T07:00:00Z')),'2026-11-01');
 assert.equal(serviceToday(new Date('2026-03-08T08:00:00Z')),'2026-03-08');
});
test('no automatic assumptions: disabled reminders, no dates, retired assets',()=>{
 assert.equal(serviceDates({}),null);
 assert.deepEqual(serviceScheduleInput({last_serviced_date:'2024-01-01'}),{last_serviced_date:'2024-01-01',service_interval_months:null,service_reminder_months:null});
});
test('validation rejects future dates, invalid calendars and incomplete or unsafe ranges',()=>{
 for(const patch of [{last_serviced_date:'2099-01-01'},{last_serviced_date:'2025-02-29'},{last_serviced_date:'2025-13-01'},{last_serviced_date:''},{service_interval_months:0},{service_interval_months:601},{service_interval_months:1.5},{service_interval_months:true},{service_reminder_months:''},{service_reminder_months:-1},{service_reminder_months:12},{service_reminder_months:121},{service_reminder_months:0.5}]) assert.throws(()=>serviceScheduleInput(scheduled(patch),'2026-09-11'),undefined,JSON.stringify(patch));
 assert.deepEqual(serviceScheduleInput(scheduled({service_interval_months:'18',service_reminder_months:'4'}),'2026-09-11'),scheduled({service_interval_months:18,service_reminder_months:4}));
 assert.equal(serviceDates(scheduled({service_reminder_months:0}),'2026-12-30').status,'upcoming');
});
test('completion advances from actual service date, disabled or deleted items leave Due Now',()=>{
 const old={id:'keep',...scheduled()};
 assert.equal(serviceReminders([old],'2027-01-01').length,1);
 assert.equal(serviceReminders([{...old,last_serviced_date:'2027-01-01'}],'2027-01-01').length,0);
 assert.equal(serviceReminders([{...old,service_interval_months:null,service_reminder_months:null}],'2027-01-01').length,0);
 assert.equal(serviceReminders([{...old,retired_at:'2026-09-01'}, {...old,service_status:'retired'},{}],'2027-01-01').length,0);
});
test('API whitelists schedule, scopes save and confirms affected row',()=>{
 const source=fs.readFileSync(new URL('../app/api/operations/route.ts',import.meta.url),'utf8');
 const block=source.split('if (action === "update_equipment")')[1].split('if (action === "review_check")')[0];
 assert.match(block,/serviceScheduleInput/); assert.match(block,/expectedUpdatedAt/); assert.match(block,/\.eq\("department_id", departmentId\)/); assert.match(block,/\.select\("id"\)\.maybeSingle\(\)/); assert.match(block,/if \(!saved\)/); assert.match(block,/changed: false/);
});
