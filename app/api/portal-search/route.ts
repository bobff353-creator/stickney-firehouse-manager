import { ensureDatabase } from '../../../db/bootstrap';
import { permissionsForEmail } from '../../server-permissions';
import { inspectionPilotAccess } from '../../fire-inspections/access';
import { trainingPilotAccess } from '../../training/access';
import { nerisPilotAccess } from '../../neris/access';
import { verifyInventoryRequest } from '../../lib/inventory-session';
import { createInventorySupabaseClient } from '../../lib/supabase-server';
import { privateSearchItem, searchPattern, type OperationalSearchItem } from '../../portal-record-search';

import { searchTerms, searchScore } from '../../search-matching';

const json = (value: unknown, status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export async function GET(request: Request) {
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(), department=request.headers.get('x-department-id');
  if(!email||!department)return json({error:'Verified department access is required.'},401);
  const query=(new URL(request.url).searchParams.get('q')||'').trim();
  if(query.length<2)return json({items:[],unavailable:[]});
  if(query.length>80)return json({error:'Use a search of 80 characters or fewer.'},400);
  try {
    const db=await ensureDatabase(), permissions=await permissionsForEmail(email,db), terms=searchTerms(query);
    if(!terms.length)return json({items:[],unavailable:[]});
    const rawWords=query.toLowerCase().match(/[\p{L}\p{N}%_\\*.'’]+/gu)||[];
    const patternGroups=terms.map(term=>[...new Set([...(term==='scba'?['scba','air pack','breathing apparatus']:[term]),...rawWords.filter(word=>searchTerms(word).join(' ')===term)])].map(searchPattern)), patterns=patternGroups.flat(), limited=new Set<string>();
    const tasks:Array<{name:string;run:()=>Promise<OperationalSearchItem[]>}>=[];
    if(permissions.has('field_preplans.view'))tasks.push({name:'Hydrants',run:async()=>{
      const rows=await db.prepare(`SELECT id,hydrant_number number,address,service_status status FROM field_hydrants WHERE service_status<>'archived' AND ${patternGroups.map(group=>"("+group.map(()=>"('hydrant ' || COALESCE(hydrant_number,'') || ' ' || COALESCE(address,'')) LIKE ? ESCAPE '\\'").join(" OR ")+")").join(" AND ")} ORDER BY CASE WHEN LOWER(hydrant_number)=? THEN 0 ELSE 1 END,hydrant_number,id LIMIT 13`).bind(...patterns,terms.filter(term=>term!=='hydrant').join(' ')).all<{id:string;number:string;address:string;status:string}>();
      if(rows.results.length>12)limited.add('Hydrants');
      return rows.results.slice(0,12).map(row=>({id:`hydrant-${row.id}`,type:'Hydrant',title:row.number||'Hydrant',detail:[row.address,row.status.replaceAll('_',' ')].filter(Boolean).join(' · '),page:'Field Preplans',record:{hydrant:row.id}}));
    }});
    for(const config of [
      {kind:'inspection' as const,table:'fire_inspection_pilot_records',allowed:inspectionPilotAccess(email),condition:"kind='inspection'"},
      {kind:'training' as const,table:'training_pilot_records',allowed:trainingPilotAccess(email),condition:"kind IN ('completion','assignment','credential')"},
      {kind:'neris' as const,table:'neris_pilot_records',allowed:nerisPilotAccess(email),condition:"kind='incident'"},
    ])if(config.allowed)tasks.push({name:config.kind,run:async()=>{
      const label=config.kind==='neris'?'incident neris':config.kind;
      const rows=await db.prepare(`SELECT id,kind,payload FROM ${config.table} WHERE department_id=? AND archived=0 AND ${config.condition} AND ${patternGroups.map(group=>'('+group.map(()=>`('${label} ' || payload) LIKE ? ESCAPE '\\'`).join(' OR ')+')').join(' AND ')} ORDER BY updated_at DESC,id LIMIT 13`).bind(department,...patterns).all<{id:string;kind:string;payload:string}>();
      if(rows.results.length>12)limited.add(config.kind);
      return rows.results.slice(0,12).map(row=>privateSearchItem(config.kind,row)).filter((item):item is OperationalSearchItem=>Boolean(item));
    }});
    if(permissions.has('inventory.view'))tasks.push({name:'Equipment',run:async()=>{
      const session=await verifyInventoryRequest(request);if(!session.ok||session.context.department.id!==department||session.context.user.email.toLowerCase()!==email)throw Error('Inventory access unavailable.');
      const supabase=await createInventorySupabaseClient();
      const equipmentTerms=terms.filter(term=>term!=='equipment');
      const anchor=[...equipmentTerms].sort((a,b)=>b.length-a.length)[0]||'';
      const anchors=anchor==='scba'?['scba','air pack','breathing apparatus']:[anchor];
      const responses=await Promise.all(anchors.flatMap(anchor=>['name','serial_number','barcode'].map(field=>supabase.from('inventory_equipment').select('id,name,serial_number,barcode,service_status,apparatus_id,compartment_id').eq('department_id',department).is('retired_at',null).ilike(field,searchPattern(anchor)).order('name').order('id').limit(50))));
      if(responses.some(response=>response.error))throw Error('Equipment search unavailable.');
      if(responses.some(response=>(response.data||[]).length>=50))limited.add('Equipment');
      const rows=new Map(responses.flatMap(response=>response.data||[]).map(row=>[row.id,row]));
      const matches=[...rows.values()].filter(row=>searchScore(row.name||'', [row.serial_number,row.barcode,row.service_status].filter(Boolean).join(' '),query,'Equipment')>0).sort((a,b)=>searchScore(b.name||'',`${b.serial_number||''} ${b.barcode||''}`,query,'Equipment')-searchScore(a.name||'',`${a.serial_number||''} ${a.barcode||''}`,query,'Equipment')||String(a.id).localeCompare(String(b.id))).slice(0,12);
      const apparatusIds=[...new Set(matches.map(row=>row.apparatus_id).filter(Boolean))], compartmentIds=[...new Set(matches.map(row=>row.compartment_id).filter(Boolean))];
      const [apparatus,compartments]=await Promise.all([
        apparatusIds.length?supabase.from('inventory_apparatus_profiles').select('id,name').eq('department_id',department).in('id',apparatusIds):Promise.resolve({data:[],error:null}),
        compartmentIds.length?supabase.from('inventory_compartments').select('id,label').eq('department_id',department).in('id',compartmentIds):Promise.resolve({data:[],error:null}),
      ]);
      const apparatusNames=new Map((apparatus.data||[]).map(row=>[row.id,row.name])), compartmentNames=new Map((compartments.data||[]).map(row=>[row.id,row.label]));
      return matches.map(row=>({id:`equipment-${row.id}`,type:'Equipment',title:row.name||'Equipment',detail:[apparatusNames.get(row.apparatus_id),compartmentNames.get(row.compartment_id),row.serial_number,row.barcode,row.service_status?.replaceAll('_',' ')].filter(Boolean).join(' · '),page:'Inventory',record:{equipment:row.id,adminTask:'equipment'}}));
    }});
    const results=await Promise.allSettled(tasks.map(task=>task.run()));
    return json({items:results.flatMap(result=>result.status==='fulfilled'?result.value:[]),limited:[...limited].sort(),unavailable:tasks.filter((_,index)=>results[index].status==='rejected').map(task=>task.name)});
  } catch {return json({error:'Operational search is unavailable. Retry; saved records have not changed.'},503);}
}
