// Actual Inventory components; isolated fictional API. No production requests or records.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Inventory from '../../app/inventory-live';
import {airCheckLines} from '../../app/inventory-air-checks';
import {airAssetInput} from '../../app/inventory-air-input';
import {serviceScheduleInput} from '../../app/inventory-service-schedule';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
import '../../app/inventory/inventory.css';
import '../../app/inventory/usability.css';
import '../../app/inventory/air-systems.css';
import '../../app/inventory/service-schedule.css';
import '../../app/suite-theme.css';

const admin=new URLSearchParams(window.location.search).get('role')!=='member';
const empty=new URLSearchParams(window.location.search).has('empty');
const rig={id:'fixture-engine',name:'Preview Engine',asset_type:'engine',status:'in_service'};
const rig2={...rig,id:'fixture-ambulance',name:'Preview Ambulance',asset_type:'ambulance'};
const compartment={id:'fixture-cab',apparatus_id:rig.id,label:'Officer seat / driver-side compartment',side:'driver',sort_order:1};
const second={...compartment,id:'fixture-cab2',apparatus_id:rig2.id,label:'Rear equipment cabinet'};
const pack={id:'fixture-pack',apparatus_id:rig.id,compartment_id:compartment.id,compartment_label:compartment.label,name:'Preview air pack with long manufacturer description',asset_number:'PACK-001',sku:'PREVIEW-SKU-01',scba_asset_kind:'pack',scba_check_slot:'pack:Officer seat',serial_number:'PREVIEW-SERIAL-001',purchase_date:'2025-01-12',hydro_test_date:null,hydro_due_date:null,updated_at:'2026-09-10T12:00:00Z',manufacturer:'Fictional audit manufacturer',model:'Preview only',service_status:'in_service',equipment_category:'air_pack',check_types:['air_pack'],quantity_required:1,item_order:0};
const bottle={...pack,id:'fixture-bottle',asset_number:'BOTTLE-001',scba_asset_kind:'bottle',name:'Preview air bottle',scba_check_slot:'spare:Spare #1',hydro_test_date:'2020-01-01',hydro_due_date:'2025-01-01'};
const chicagoDay=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long'}).format(new Date());
const data:any={configured:true,apparatus:[rig,rig2],compartments:[compartment,second],equipment:empty?[]:[pack,bottle],retiredEquipment:[],checks:[],checkItems:[],exceptions:[],workOrders:[],workOrderDocuments:[],inspectionSchedules:[{id:'fixture-schedule',apparatus_id:rig.id,check_type:'air_pack',day_of_week:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(chicagoDay),start_time:'06:00',end_time:'12:00',active:true,feeds_operations_board:true}],stock:[],restockRequests:[],locationChanges:[],scbaTemplates:[{id:'fixture-template',apparatus_id:rig.id,active:true,pack_positions:['Officer seat','Rear seat'],include_rit:true,spare_bottle_count:1}],scbaEntries:[]};
let writes=0;
if(new URLSearchParams(window.location.search).has('service')) {
 Object.assign(pack,{last_serviced_date:'2024-12-31',service_interval_months:24,service_reminder_months:4});
 data.equipment.push({id:'fixture-spreaders',apparatus_id:rig.id,compartment_id:compartment.id,compartment_label:compartment.label,name:'Preview Spreaders',equipment_category:'equipment',check_types:['inventory'],item_type:'individual',quantity_required:1,service_status:'in_service',updated_at:'2026-09-10T12:00:00Z',last_serviced_date:'2020-01-31',service_interval_months:60,service_reminder_months:3});
}
(window as any).airAudit={data,requests:[],errors:[]};
window.fetch=async(input,init)=>{
 const url=String(input); if(!url.startsWith('/api/'))throw Error('External request blocked in fictional fixture');
 (window as any).airAudit.requests.push({url,method:init?.method||'GET'});
 if(init?.method==='POST'){
  writes++;document.getElementById('audit-writes')!.textContent=`Test writes: ${writes}`;
  if((document.getElementById('fail-save') as HTMLInputElement).checked){(document.getElementById('fail-save') as HTMLInputElement).checked=false;return Response.json({error:'Simulated save failure. Your edits were not saved.'},{status:503});}
  const body=JSON.parse(String(init.body));
  (window as any).airAudit.requests.at(-1).body=body;
  if(body.action==='update_equipment') {
   if(!admin)return Response.json({error:'Setup permission required'},{status:403});
   const item=data.equipment.find((item:any)=>item.id===body.equipmentId);
   if(!item||body.expectedUpdatedAt!==item.updated_at)return Response.json({error:'This item changed on another screen. Reopen it before saving.'},{status:409});
   try { Object.assign(item,serviceScheduleInput(body.serviceSchedule),{name:body.name,updated_at:new Date().toISOString()}); }
   catch(caught){return Response.json({error:String(caught)},{status:400});}
   return Response.json({equipment:item,changed:true});
  }
  if(body.action==='save_air_asset'){
   if(!admin)return Response.json({error:'Setup permission required'},{status:403});
   const asset=airAssetInput(body.asset),target=data.equipment.find((item:any)=>item.id===body.id);
   if(data.equipment.some((item:any)=>item.id!==body.id && item.asset_number?.toLowerCase()===String(asset.asset_number).toLowerCase()))return Response.json({error:'That ID is already assigned.'},{status:409});
   if(target && body.expectedUpdatedAt!==target.updated_at)return Response.json({error:'This record changed on another screen. Reopen it before saving.'},{status:409});
   const place=data.compartments.find((item:any)=>item.id===asset.compartment_id);
   const saved={...pack,...asset,id:body.id,apparatus_id:place.apparatus_id,compartment_label:place.label,updated_at:new Date().toISOString()};
   if(target)Object.assign(target,saved);else data.equipment.push(saved);
   return Response.json({id:body.id,changed:true});
  }
  if(body.action==='log_air_maintenance'){data.workOrders.push({id:body.id,equipment_id:body.equipmentId,status:'closed',summary:body.summary,repair_date:body.repairDate,repair_cost:body.repairCost||null,resolution_notes:body.resolutionNotes,vendor:body.vendor,invoice_number:body.invoiceNumber,performed_by:body.performedBy,next_service_due_date:body.nextServiceDueDate});return Response.json({id:body.id});}
  if(body.action==='save_inspection_schedule'){const existing=data.inspectionSchedules.find((item:any)=>item.id===body.id);const saved={id:body.id||crypto.randomUUID(),apparatus_id:body.apparatusId,check_type:body.checkType,day_of_week:body.dayOfWeek,start_time:body.startTime,end_time:body.endTime,active:true,feeds_operations_board:true};if(existing)Object.assign(existing,saved);else data.inspectionSchedules.push(saved);return Response.json({scheduleId:saved.id});}
  if(body.action==='save_scba_template'){const existing=data.scbaTemplates.find((item:any)=>item.apparatus_id===body.apparatusId);const saved={apparatus_id:body.apparatusId,pack_positions:body.packPositions,include_rit:body.includeRit,spare_bottle_count:body.spareBottleCount,active:true,updated_at:new Date().toISOString()};if(existing)Object.assign(existing,saved);else data.scbaTemplates.push({...saved,id:crypto.randomUUID()});return Response.json({ok:true});}
  if(body.action==='start_check'){let check=data.checks.find((item:any)=>item.apparatus_id===body.apparatusId&&item.status==='in_progress');if(!check){check={id:crypto.randomUUID(),apparatus_id:body.apparatusId,check_type:'air_pack',status:'in_progress',started_by:'Fictional member',started_at:new Date().toISOString()};data.checks.push(check);const template=data.scbaTemplates.find((item:any)=>item.apparatus_id===body.apparatusId);data.scbaEntries.push(...airCheckLines(template,data.equipment,body.apparatusId).map((line,index)=>({...line,id:crypto.randomUUID(),check_id:check.id,sort_order:index,result:'pending',harness_number:line.section==='pack'?line.asset_number:null,cylinder_number:line.section!=='pack'?line.asset_number:null,location_snapshot:line.location})));}return Response.json({checkId:check.id});}
  if(body.action==='record_scba_entry'){Object.assign(data.scbaEntries.find((item:any)=>item.id===body.entryId),{result:body.result,harness_number:body.harnessNumber,cylinder_number:body.cylinderNumber,psi:body.psi,notes:body.notes,checked_at:new Date().toISOString(),checked_by:'Preview member'});return Response.json({ok:true});}
  return Response.json({error:'Unsupported fictional save'},{status:409});
 }
 if(url.startsWith('/api/permissions'))return Response.json({viewerPermissions:['inventory.view','inventory.check',...(admin?['inventory.setup.manage','inventory.repairs.manage']:[])],revision:'fixture',identity:'fictional',employees:[]});
 if((document.getElementById('fail-read') as HTMLInputElement)?.checked && url.startsWith('/api/operations'))return Response.json({error:'Simulated reconnect failure'},{status:503});
 if(url.startsWith('/api/operations'))return Response.json(data);
 if(url.startsWith('/api/digital-twin'))return Response.json({...data,photos:[],hotspots:[]});
 if(url.startsWith('/api/suite-context'))return Response.json({configured:true,department:{id:'fixture',name:'Preview department'},apparatus:data.apparatus.map((r:any)=>({...r,unit_name:r.name,unit_type:r.asset_type,call_sign:r.name})),events:[]});
 if(url.startsWith('/api/dashboard'))return Response.json({viewer:{employeeId:'fixture-member'}});
 return Response.json({error:'Unknown fixture request'},{status:404});
};
window.addEventListener('error',event=>(window as any).airAudit.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>(window as any).airAudit.errors.push(String(event.reason)));
createRoot(document.getElementById('root')!).render(<><aside style={{padding:8,background:'#fff4be',font:'12px Arial'}}>Fictional local verification · {admin?'Admin':'Member'} · <span id="audit-writes">Test writes: 0</span><label><input id="fail-save" type="checkbox"/>Fail next save</label><label><input id="fail-read" type="checkbox"/>Fail reads</label></aside><Inventory departmentId="fixture" departmentName="Preview department" permissions={[]} /></>);
