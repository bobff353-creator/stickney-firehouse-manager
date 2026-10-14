import { ensureDatabase } from '../../../db/bootstrap';
import { permissionsForEmail } from '../../server-permissions';
import { inspectionPilotAccess } from '../../fire-inspections/access';
import { trainingPilotAccess } from '../../training/access';
import { nerisPilotAccess } from '../../neris/access';
import { verifyInventoryRequest } from '../../lib/inventory-session';
import { createInventorySupabaseClient } from '../../lib/supabase-server';
import { privateSearchItem, searchPattern, type OperationalSearchItem } from '../../portal-record-search';

const json = (value: unknown, status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export async function GET(request: Request) {
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(), department=request.headers.get('x-department-id');
  if(!email||!department)return json({error:'Verified department access is required.'},401);
  const query=(new URL(request.url).searchParams.get('q')||'').trim();
  if(query.length<2)return json({items:[],unavailable:[]});
  if(query.length>80)return json({error:'Use a search of 80 characters or fewer.'},400);
  try {
    const db=await ensureDatabase(), permissions=await permissionsForEmail(email,db), pattern=searchPattern(query);
    const tasks:Array<{name:string;run:()=>Promise<OperationalSearchItem[]>}>=[];
    if(permissions.has('field_preplans.view'))tasks.push({name:'Hydrants',run:async()=>{
      const rows=await db.prepare("SELECT id,hydrant_number number,address,service_status status FROM field_hydrants WHERE service_status<>'archived' AND (hydrant_number LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\') ORDER BY hydrant_number,id LIMIT 8").bind(pattern,pattern).all<{id:string;number:string;address:string;status:string}>();
      return rows.results.map(row=>({id:`hydrant-${row.id}`,type:'Hydrant',title:row.number||'Hydrant',detail:[row.address,row.status.replaceAll('_',' ')].filter(Boolean).join(' · '),page:'Field Preplans',record:{hydrant:row.id}}));
    }});
    for(const config of [
      {kind:'inspection' as const,table:'fire_inspection_pilot_records',allowed:inspectionPilotAccess(email),condition:"kind='inspection'"},
      {kind:'training' as const,table:'training_pilot_records',allowed:trainingPilotAccess(email),condition:"kind IN ('completion','assignment','credential')"},
      {kind:'neris' as const,table:'neris_pilot_records',allowed:nerisPilotAccess(email),condition:"kind='incident'"},
    ])if(config.allowed)tasks.push({name:config.kind,run:async()=>{
      const rows=await db.prepare(`SELECT id,kind,payload FROM ${config.table} WHERE department_id=? AND archived=0 AND ${config.condition} AND payload LIKE ? ESCAPE '\\' ORDER BY updated_at DESC,id LIMIT 8`).bind(department,pattern).all<{id:string;kind:string;payload:string}>();
      return rows.results.map(row=>privateSearchItem(config.kind,row)).filter((item):item is OperationalSearchItem=>Boolean(item));
    }});
    if(permissions.has('inventory.view'))tasks.push({name:'Equipment',run:async()=>{
      const session=await verifyInventoryRequest(request);if(!session.ok||session.context.department.id!==department||session.context.user.email.toLowerCase()!==email)throw Error('Inventory access unavailable.');
      const supabase=await createInventorySupabaseClient();
      const responses=await Promise.all(['name','serial_number','barcode'].map(field=>supabase.from('inventory_equipment').select('id,name,serial_number,barcode,service_status').eq('department_id',department).is('retired_at',null).ilike(field,pattern).order('name').order('id').limit(8)));
      if(responses.some(response=>response.error))throw Error('Equipment search unavailable.');
      const rows=new Map(responses.flatMap(response=>response.data||[]).map(row=>[row.id,row]));
      return [...rows.values()].slice(0,8).map(row=>({id:`equipment-${row.id}`,type:'Equipment',title:row.name||'Equipment',detail:[row.serial_number,row.barcode,row.service_status].filter(Boolean).join(' · '),page:'Inventory',record:{equipment:row.id,adminTask:'equipment'}}));
    }});
    const results=await Promise.allSettled(tasks.map(task=>task.run()));
    return json({items:results.flatMap(result=>result.status==='fulfilled'?result.value:[]),unavailable:tasks.filter((_,index)=>results[index].status==='rejected').map(task=>task.name)});
  } catch {return json({error:'Operational search is unavailable. Retry; saved records have not changed.'},503);}
}
