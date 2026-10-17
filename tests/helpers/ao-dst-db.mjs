import {resolve} from 'node:path';
import {payrollDatabaseFixture} from './payroll-submission-db.mjs';
import {trainingModules} from './training-modules.mjs';
import * as operational from '../../app/operational-day.ts';
export async function fixture(today='2026-10-16') {
  const f=await payrollDatabaseFixture();
  await f.pg.exec(`ALTER TABLE firehouse.daily_logs ADD locked int DEFAULT 0,ADD locked_by text,ADD locked_at text,ADD admin_unlocked int DEFAULT 0,ADD updated_at text,ADD created_by text,ADD created_at text;
    ALTER TABLE firehouse.daily_log_staffing ADD acting_officer int DEFAULT 0,ADD sort_order int;
    ALTER TABLE firehouse.daily_log_calls ADD report_number text,ADD time_out text,ADD time_in text,ADD responding_units text,ADD address text,ADD call_type text,ADD sort_order int;
    ALTER TABLE firehouse.pay_periods ADD updated_by text;
    ALTER TABLE firehouse.time_entries ADD updated_at text;
    ALTER TABLE firehouse.employee_profiles ADD acting_officer_eligible int DEFAULT 1;
    ALTER TABLE firehouse.daily_log_approvals ADD sign_in_at text,ADD sign_in_officer_id text,ADD sign_out_officer_id text,ADD sign_in_equipment text,ADD sign_in_note text,ADD reviewed_notes int,ADD sign_out_equipment text,ADD sign_out_note text,ADD fleet_duties_acknowledged int;
    ALTER TABLE firehouse.record_revisions ADD changed_at text;
    CREATE TABLE firehouse.dispatch_incidents(incident_id text,active int,cleared_at text,dispatched_at text,time_out text,responding_units text,address text,call_type text);`);
  const api=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>f.db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>true},[resolve('app/operational-day.ts')]:{...operational,chicagoOperationalContext:()=>({operationalDate:today,lockBeforeDate:'1900-01-01'})}})('app/api/logbook/route.ts');
  const prepare=async date=>f.pg.query('INSERT INTO firehouse.daily_logs(log_date) VALUES($1) ON CONFLICT DO NOTHING',[date]);
  const version=async date=>(await f.pg.query('SELECT save_version FROM firehouse.daily_logs WHERE log_date=$1',[date])).rows[0].save_version;
  const post=async(date,rows,expectedVersion=undefined)=>{
    const response=await api.POST(new Request('https://fixture.invalid/api/logbook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({logDate:date,action:'save',expectedVersion:expectedVersion??await version(date),staffing:rows,calls:[],shiftNotes:'Synthetic clarified rules'})}));
    return{status:response.status,body:await response.json()};
  };
  const handoff=async date=>api.POST(new Request('https://fixture.invalid/api/logbook',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':'admin@example.test'},body:JSON.stringify({logDate:date,action:'handoff',shiftKey:'morning',mode:'in',officerId:'a',reviewedNotes:true})}));
  const get=async date=>{const response=await api.GET(new Request('https://fixture.invalid/api/logbook?date='+date));return{status:response.status,body:await response.json()};};
  return{...f,prepare,version,post,handoff,get};
}
