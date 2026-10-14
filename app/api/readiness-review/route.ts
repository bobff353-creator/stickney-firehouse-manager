import { ensureDatabase } from '../../../db/bootstrap';
import { permissionsForEmail } from '../../server-permissions';
import { trainingPilotAccess } from '../../training/access';
import { inspectionPilotAccess } from '../../fire-inspections/access';
import { verifyInventoryRequest } from '../../lib/inventory-session';
import { createInventorySupabaseClient } from '../../lib/supabase-server';
import { readScheduleSafety } from '../../schedule-safety-store';
import { evaluatePreplanExpirations } from '../../preplans/expiration-evaluator';
import { chicagoQueueDate, inspectionTasks, taskDueState, type PilotTaskRow } from '../../task-queue-model';
import { apparatusReview, checkReview, credentialReview, crewReview, reviewThrough, type ReviewGroup, type ReviewMember, type ReviewSignal, type ReviewSource } from '../../readiness-review-model';
import type { SafetySlot } from '../../schedule-safety';
import type { SupabaseClient } from '@supabase/supabase-js';
type Row=Record<string,unknown>;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
async function pages(query:(from:number,to:number)=>PromiseLike<{data:Row[]|null;error:unknown}>){const rows:Row[]=[];for(let from=0;from<10000;from+=1000){const result=await query(from,from+999);if(result.error||!result.data)throw Error('Source unavailable');rows.push(...result.data);if(result.data.length<1000)return rows;}throw Error('Open the source module to review the larger dataset.');}
async function inventoryRecords(client:SupabaseClient,department:string,today:string){
  const from=reviewThrough(today,-8);
  const [fleet,equipment,repairs,exceptions,schedules,completed,open]=await Promise.all([
    pages((a,b)=>client.from('department_apparatus').select('id,unit_name,status').eq('department_id',department).order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_equipment').select('id,name,service_status,retired_at,expiration_date,hydro_due_date,scba_asset_kind,last_serviced_date,service_interval_months,service_reminder_months').eq('department_id',department).is('retired_at',null).order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_work_orders').select('id,equipment_id,status').eq('department_id',department).not('status','in','(closed,completed,cancelled,canceled,resolved)').order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_readiness_exceptions').select('id,equipment_id,status').eq('department_id',department).not('status','in','(resolved,cancelled,canceled)').order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_inspection_schedules').select('id,apparatus_id,check_type,day_of_week,start_time,end_time,active').eq('department_id',department).eq('active',true).order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_checks').select('id,apparatus_id,check_type,status,completed_at,review_status').eq('department_id',department).eq('status','completed').gte('completed_at',from+'T00:00:00Z').order('id').range(a,b)),
    pages((a,b)=>client.from('inventory_checks').select('id,apparatus_id,check_type,status,completed_at,review_status').eq('department_id',department).eq('status','in_progress').order('id').range(a,b)),
  ]);return {fleet,equipment,repairs,exceptions,schedules,checks:[...new Map([...completed,...open].map(row=>[row.id,row])).values()]};
}
export async function GET(request:Request){
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(),department=request.headers.get('x-department-id');
  if(!email||!department)return json({error:'Verified department access is required.'},401);
  const params=new URL(request.url).searchParams,scope=params.get('scope')||'chief',days=Number(params.get('days')||30);
  if(!['chief','staffing'].includes(scope)||![7,30,90].includes(days))return json({error:'Choose a 7, 30 or 90 day review window.'},400);
  try{
    const db=await ensureDatabase(),permissions=await permissionsForEmail(email,db),today=chicagoQueueDate(),through=reviewThrough(today,days);
    if(!permissions.has(scope==='staffing'?'scheduling.manage':'command_center.view'))return json({error:'This account does not have access to this review.'},403);
    const canCrew=permissions.has('scheduling.manage');
    const crew=canCrew?(async()=>{
      const [members,slots,safety]=await Promise.all([
        db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.driver_status,'') driverStatus,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible,COALESCE(ep.single_role,0) singleRole FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.end_date IS NULL OR ep.end_date='' OR ep.end_date>=?) ORDER BY e.id LIMIT 10001").bind(today).all<ReviewMember>(),
        db.prepare("SELECT s.id,s.role,s.employee_id employeeId,e.name employeeName,s.status,en.entry_date entryDate,COALESCE(NULLIF(s.start_time,''),t.start_time) startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) endTime FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id AND t.active=1 LEFT JOIN employees e ON e.id=s.employee_id WHERE en.entry_date>=? AND en.entry_date<=? ORDER BY en.entry_date,s.id LIMIT 10001").bind(reviewThrough(today,-1),through).all<SafetySlot>(),
        readScheduleSafety(db),
      ]);if(members.results.length>10000||slots.results.length>10000)throw Error('Review the larger schedule in Scheduling.');
      return {members:members.results,slots:slots.results,rules:safety.rules};
    })():null;
    // Consume a shared failure once; each dependent source remains explicitly unavailable.
    const crewResult=crew?crew.then(value=>({value,error:false})).catch(()=>({value:null,error:true})):Promise.resolve({value:null,error:false});
    const configs:Array<{group:ReviewGroup;allowed:boolean;note:string;run:()=>Promise<ReviewSignal[]>}>=[
      {group:'Crew',allowed:canCrew,note:'Saved positions and department schedule-review rules within the selected window.',run:async()=>{const result=await crewResult;if(!result.value)throw Error('Staffing unavailable');return crewReview(result.value.slots,result.value.members,result.value.rules,today,through);}},
      {group:'Credentials',allowed:trainingPilotAccess(email),note:'Private recorded renewal dates; advisory only. No notices or eligibility changes.',run:async()=>{
        const [rows,staffing]=await Promise.all([db.prepare("SELECT id,kind,payload FROM training_pilot_records WHERE department_id=? AND archived=0 AND kind='credential' ORDER BY id LIMIT 10001").bind(department).all<PilotTaskRow>(),crewResult]);if(rows.results.length>10000)throw Error('Open Training for the larger dataset.');
        return credentialReview(rows.results,staffing.value?.slots||null,new Map(staffing.value?.members.map(m=>[m.id,m.name])||[]),today,through);
      }},
    ];
    if(scope==='chief'){
      let inventory:Promise<Awaited<ReturnType<typeof inventoryRecords>>>|null=null;
      function loadInventory(){if(!inventory)inventory=(async()=>{const session=await verifyInventoryRequest(request);if(!session.ok||session.context.department.id!==department||session.context.user.email.toLowerCase()!==email)throw Error('Inventory access unavailable');return inventoryRecords(await createInventorySupabaseClient(),department!,today);})();return inventory;}
      configs.push(
        {group:'Apparatus',allowed:permissions.has('inventory.view'),note:'Saved apparatus service status and active equipment date/defect flags.',run:async()=>{const data=await loadInventory();return apparatusReview(data.fleet,data.equipment,data.repairs,data.exceptions);}},
        {group:'Checks',allowed:permissions.has('inventory.view'),note:'All active check schedules for today; includes later scheduled windows.',run:async()=>{const data=await loadInventory();return checkReview(data.schedules,data.fleet,data.checks,today);}},
        {group:'Preplans',allowed:permissions.has('field_preplans.view'),note:'Recorded expiration dates on published preplans, using the existing 30-day warning window.',run:async()=>{const data=await evaluatePreplanExpirations(db);if(data.reviewCount>10000)throw Error('Open Preplans for the larger dataset.');return [...data.expired,...data.upcoming,...data.invalid].map(row=>({id:'preplan:'+row.kind+':'+row.id,group:'Preplans',severity:row.state==='invalid'?'Unknown':row.state==='expired'?'Urgent':'Review',title:row.preplanName+' · '+row.recordName,detail:row.kind+' · '+row.state+' · Recorded expiration: '+row.expiresAt,date:'',href:'/?'+new URLSearchParams({display:'portal',page:'field-preplans',preplan:row.preplanId}).toString()}));}},
        {group:'Prevention',allowed:inspectionPilotAccess(email),note:'Private open inspection visits and unresolved corrections. Test and archived records excluded.',run:async()=>{const rows=await db.prepare("SELECT id,kind,payload FROM fire_inspection_pilot_records WHERE department_id=? AND archived=0 AND kind='inspection' ORDER BY id LIMIT 10001").bind(department).all<PilotTaskRow>();if(rows.results.length>10000)throw Error('Open Inspections for the larger dataset.');const staffing=await crewResult;const names=new Map(staffing.value?.members.map(m=>[m.id,m.name])||[]);names.set('pilot-owner','Private pilot owner');return inspectionTasks(rows.results,names).map(task=>{const state=taskDueState(task,today);return{id:task.id,group:'Prevention',severity:state==='Date needs review'||state==='Date needed'?'Unknown':state==='Overdue'||state==='Today'?'Urgent':'Review',title:task.title,detail:task.status+' · '+state+' · '+task.detail,date:task.dueDate,href:task.href};});}},
      );
    }
    const results=await Promise.allSettled(configs.map(config=>config.allowed?config.run():Promise.resolve([]))),sources:ReviewSource[]=configs.map((config,index)=>({group:config.group,state:!config.allowed?'restricted':results[index].status==='rejected'?'unavailable':'ready',note:config.allowed?config.note:'This source is outside your current access.'}));
    const rank={Urgent:0,Unknown:1,Review:2};const items=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>rank[a.severity]-rank[b.severity]||a.date.localeCompare(b.date)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
    return json({items,sources,today,through,generatedAt:new Date().toISOString()});
  }catch{return json({error:'Readiness review could not load. Retry; saved records have not changed.'},503);}
}
