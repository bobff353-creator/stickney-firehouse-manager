import { ensureDatabase } from '../../../db/bootstrap';
import { permissionsForEmail } from '../../server-permissions';
import { inspectionPilotAccess } from '../../fire-inspections/access';
import { trainingPilotAccess } from '../../training/access';
import { verifyInventoryRequest } from '../../lib/inventory-session';
import { createInventorySupabaseClient } from '../../lib/supabase-server';
import { chicagoQueueDate, inspectionTasks, repairTasks, sortQueue, trainingTasks, type QueueTask, type PilotTaskRow } from '../../task-queue-model';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export async function GET(request:Request){
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(),department=request.headers.get('x-department-id');
  if(!email||!department)return json({error:'Verified department access is required.'},401);
  try{
    const db=await ensureDatabase(),permissions=await permissionsForEmail(email,db);
    if(!permissions.has('dashboard.view'))return json({error:'Portal task queue access is required.'},403);
    const member=await db.prepare('SELECT id FROM employees WHERE active=1 AND id=employee_id_for_login(?) LIMIT 1').bind(email).first<{id:string}>();
    const privateAccess=inspectionPilotAccess(email)||trainingPilotAccess(email);
    const viewerIds=[...(member?[member.id]:[]),...(inspectionPilotAccess(email)?['pilot-owner']:[])];
    const tasks:Array<{name:string;run:()=>Promise<QueueTask[]>}>=[];
    // Private assignment labels never load for ordinary department viewers.
    let names:Promise<Map<string,string>>|null=null;
    function memberNames(){
      if(!names)names=db.prepare('SELECT id,name FROM employees ORDER BY id LIMIT 10001').all<{id:string;name:string}>().then(rows=>{if(rows.results.length>10000)throw Error('Open the module to review this larger roster.');const result=new Map(rows.results.map(row=>[row.id,row.name]));result.set('pilot-owner','Private pilot owner');return result;});return names;
    }
    if(inspectionPilotAccess(email))tasks.push({name:'Inspections',run:async()=>{
      const rows=await db.prepare("SELECT id,kind,payload FROM fire_inspection_pilot_records WHERE department_id=? AND archived=0 AND kind='inspection' ORDER BY id LIMIT 10001").bind(department).all<PilotTaskRow>();
      if(rows.results.length>10000)throw Error('Open Inspections to review the larger queue.');
      return inspectionTasks(rows.results,await memberNames());
    }});
    if(trainingPilotAccess(email))tasks.push({name:'Training and credentials',run:async()=>{
      const rows=await db.prepare("SELECT id,kind,payload FROM training_pilot_records WHERE department_id=? AND archived=0 AND kind IN ('assignment','completion','credential') ORDER BY id LIMIT 10001").bind(department).all<PilotTaskRow>();
      if(rows.results.length>10000)throw Error('Open Training to review the larger queue.');
      return trainingTasks(rows.results,await memberNames());
    }});
    if(permissions.has('inventory.view'))tasks.push({name:'Repairs',run:async()=>{
      const session=await verifyInventoryRequest(request);if(!session.ok||session.context.department.id!==department||session.context.user.email.toLowerCase()!==email)throw Error('Inventory access unavailable.');
      const supabase=await createInventorySupabaseClient();
      const result=await supabase.from('inventory_work_orders').select('id,summary,details,status,priority,due_at,assigned_to,assigned_employee_ids,assigned_employee_names').eq('department_id',department).not('status','in','(closed,cancelled,canceled,resolved,completed)').order('id').limit(1001);
      if(result.error||!result.data||result.data.length>1000)throw Error('Open Repairs to review the current queue.');
      return repairTasks(result.data);
    }});
    const results=await Promise.allSettled(tasks.map(task=>task.run())),today=chicagoQueueDate();
    return json({items:sortQueue(results.flatMap(result=>result.status==='fulfilled'?result.value:[]),today),today,viewerIds,privateAccess,sources:tasks.map((task,index)=>({name:task.name,state:results[index].status==='fulfilled'?'ready':'unavailable'})),generatedAt:new Date().toISOString()});
  }catch{return json({error:'The task queue could not load. Retry; saved work has not changed.'},503);}
}
