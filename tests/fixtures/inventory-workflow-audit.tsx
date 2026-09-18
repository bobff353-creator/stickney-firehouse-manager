/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser-only fictional workflow harness. No credentials or production fetches.
// Mock transport proves UI behavior; database guarantees are tested separately in
// inventory-atomic-results.test.mjs against the actual SQL functions.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Inventory from '../../app/inventory-live';
import {airCheckLines} from '../../app/inventory-air-checks';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
import '../../app/admin-usability.css';
import '../../app/inventory/inventory.css';
import '../../app/inventory/usability.css';
import '../../app/inventory/air-systems.css';
import '../../app/inventory/service-schedule.css';
import '../../app/suite-theme.css';
import '../../app/workflow-usability.css';

if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw Error('Local fixtures only');
const key='fictional-inventory-workflow-v1';
const rig={id:'fixture-engine',name:'TEST ONLY Engine',asset_type:'engine',status:'in_service'};
const cabinet={id:'fixture-cabinet',apparatus_id:rig.id,label:'Driver side cabinet',side:'driver',sort_order:1};
const base={apparatus_id:rig.id,compartment_id:cabinet.id,compartment_label:cabinet.label,quantity_required:1,check_types:['daily','weekly','inventory'],equipment_category:'equipment',response_type:'pass_fail',service_status:'in_service',updated_at:'2026-09-17T12:00:00Z'};
const equipment=[
 {...base,id:'fixture-mileage',name:'TEST Odometer',response_type:'mileage',item_order:0},
 {...base,id:'fixture-radio',name:'TEST Portable radio',barcode:'TEST-RADIO',item_order:1},
 {...base,id:'fixture-light',name:'TEST Hand light',item_order:2},
 {...base,id:'fixture-pack',name:'TEST Air pack',asset_number:'TEST-PACK-001',equipment_category:'air_pack',scba_asset_kind:'pack',scba_check_slot:'pack:Officer seat',check_types:['air_pack']},
 {...base,id:'fixture-bottle',name:'TEST Spare cylinder',asset_number:'TEST-BOTTLE-001',equipment_category:'air_pack',scba_asset_kind:'bottle',scba_check_slot:'spare:Spare #1',check_types:['air_pack'],hydro_test_date:'2025-01-01',hydro_due_date:'2030-01-01'},
];
const template={id:'fixture-template',apparatus_id:rig.id,active:true,pack_positions:['Officer seat'],include_rit:true,spare_bottle_count:1};
const initial={configured:true,apparatus:[rig,{...rig,id:'fixture-ambulance',name:'TEST ONLY Ambulance',asset_type:'ambulance'}],compartments:[cabinet],equipment,retiredEquipment:[],checks:[],checkItems:[],exceptions:[],workOrders:[],workOrderDocuments:[],inspectionSchedules:[],stock:[{id:'fixture-stock',name:'TEST Gloves',unit:'boxes',par_level:5,reorder_point:2,lot_id:'fixture-lot',quantity_on_hand:2,lot_number:'TEST-LOT'}],restockRequests:[],locationChanges:[],scbaTemplates:[template],scbaEntries:[],photos:[],hotspots:[]};
const data:any=JSON.parse(sessionStorage.getItem(key)||JSON.stringify(initial));
const admin=new URLSearchParams(location.search).get('role')!=='member';
let writes=0;
const stamp=()=>new Date().toISOString();
const persist=()=>sessionStorage.setItem(key,JSON.stringify(data));
const bad=(error:string,status=400)=>Response.json({error},{status});
const ok=(value:object={ok:true})=>{persist();return Response.json(value);};
window.fetch=async(input,init)=>{
 const url=String(input);
 if(!url.startsWith('/api/'))throw Error('External fetch blocked by local inventory audit');
 if(init?.method==='POST'){
  const fail=document.getElementById('fail-save') as HTMLInputElement;
  if(fail.checked){fail.checked=false;return bad('Simulated save failure. Your edits were not saved.',503);}
  if(init.body instanceof FormData) return bad('Photo storage is not simulated by this workflow fixture.');
  const b=JSON.parse(String(init.body));
  document.getElementById('audit-writes')!.textContent=`Test writes: ${++writes} · ${b.action}`;
  if(b.action==='start_check'){
   let check=data.checks.find((c:any)=>c.apparatus_id===b.apparatusId&&c.check_type===b.checkType&&c.status==='in_progress');
   if(check)return ok({checkId:check.id,resumed:true});
   const items=data.equipment.filter((e:any)=>e.apparatus_id===b.apparatusId&&e.check_types.includes(b.checkType));
   if(!items.length)return bad('No configured items');
   check={id:crypto.randomUUID(),apparatus_id:b.apparatusId,apparatus_name:rig.name,check_type:b.checkType,status:'in_progress',started_at:stamp(),started_by:'Fictional crew'};
   data.checks.unshift(check);
   if(b.checkType==='air_pack') data.scbaEntries.push(...airCheckLines(template,data.equipment,b.apparatusId).map(line=>({...line,id:crypto.randomUUID(),check_id:check.id,result:'pending'})));
   else data.checkItems.push(...items.map((e:any)=>({...e,id:crypto.randomUUID(),equipment_id:e.id,equipment_name:e.name,check_id:check.id,result:'pending'})));
   return ok({checkId:check.id,resumed:false});
  }
  if(b.action==='record_check_item'||b.action==='bulk_record_check_items'){
   const ids=b.checkItemIds||[b.checkItemId],items=data.checkItems.filter((i:any)=>ids.includes(i.id));
   if(!items.length||items.some((i:any)=>data.checks.find((c:any)=>c.id===i.check_id)?.status!=='in_progress'))return bad('No editable check items');
   if(items.some((i:any)=>['numeric','mileage','quantity'].includes(i.response_type))&&(b.numericReading==null||Number(b.numericReading)<0))return bad('Enter a nonnegative reading');
   if(b.result==='failed')return bad('Photo evidence storage is not simulated. Use the database failure-path tests.');
   items.forEach((i:any)=>Object.assign(i,{result:b.result||'pass',numeric_reading:b.numericReading,notes:b.notes||null,checked_at:stamp(),checked_by:'Fictional crew'}));
   return ok({saved:true,checkItems:items});
  }
  if(b.action==='record_scba_entry'){
   const entry=data.scbaEntries.find((e:any)=>e.id===b.entryId);
   if(!entry||data.checks.find((c:any)=>c.id===entry.check_id)?.status!=='in_progress')return bad('No editable air check');
   if(b.result!=='not_applicable'&&(!b.cylinderNumber||(entry.section==='pack'&&!b.harnessNumber)||b.psi==null||Number(b.psi)<0||Number(b.psi)>6000))return bad('Record required IDs and PSI');
   if(b.result==='failed'&&!b.notes)return bad('Describe the failure');
   Object.assign(entry,{harness_number:b.result==='not_applicable'?null:b.harnessNumber||null,cylinder_number:b.result==='not_applicable'?null:b.cylinderNumber||null,psi:b.result==='not_applicable'?null:Number(b.psi),result:b.result,notes:b.notes||null,checked_at:stamp(),checked_by:'Fictional crew'});
   return ok({scbaEntry:entry});
  }
  if(b.action==='complete_check'){
   const check=data.checks.find((c:any)=>c.id===b.checkId);
   const items=(check?.check_type==='air_pack'?data.scbaEntries:data.checkItems).filter((i:any)=>i.check_id===b.checkId);
   if(!check||!items.length||items.some((i:any)=>i.result==='pending'))return bad('Finish every item before submitting');
   Object.assign(check,{status:'completed',review_status:'pending',completed_at:stamp(),completed_by:'Fictional crew'});
   return ok({checkId:check.id,completed:true});
  }
  if(b.action==='review_check'){
   if(!admin)return bad('Administrator required',403);
   if(b.decision==='changes_requested'&&!b.reviewNotes)return bad('Enter a review note');
   const check=data.checks.find((c:any)=>c.id===b.checkId&&c.status==='completed');
   if(!check)return bad('No completed check');
   Object.assign(check,{review_status:b.decision,review_notes:b.reviewNotes,reviewed_at:stamp()});return ok();
  }
  if(b.action==='update_equipment'){
   const item=data.equipment.find((e:any)=>e.id===b.equipmentId);
   if(!admin||!item)return bad('No editable equipment',403);
   Object.assign(item,{name:b.name,quantity_required:Number(b.quantityRequired),check_types:b.checkTypes,response_type:b.responseType,barcode:b.barcode,updated_at:stamp()});return ok();
  }
  if(b.action==='create_notice'||b.action==='create_work_order'){
   data.workOrders.push({id:crypto.randomUUID(),apparatus_id:b.apparatusId,apparatus_name:rig.name,equipment_id:b.equipmentId,status:'open',priority:b.priority,summary:b.summary||b.notes,details:b.details||b.notes,created_at:stamp(),opened_at:stamp(),opened_by:'Fictional crew',repair_cost:0,labor_hours:0,service_type:b.serviceType||'repair',assigned_employee_names:b.assignedEmployeeNames});return ok();
  }
  if(b.action==='update_work_order_status'||b.action==='close_work_order'){
   const item=data.workOrders.find((i:any)=>i.id===b.workOrderId);if(!item)return bad('Unknown repair');
   Object.assign(item,{status:b.status||'closed'});
   if(b.action==='close_work_order')Object.assign(item,{resolution_notes:b.resolutionNotes,closed_at:stamp(),repair_date:b.repairDate,repair_cost:Number(b.repairCost||0),labor_hours:Number(b.laborHours||0),performed_by:b.performedBy,service_type:b.serviceType,vendor:b.vendor,invoice_number:b.invoiceNumber,parts_used:b.partsUsed,odometer:b.odometer});return ok();
  }
  if(b.action==='adjust_stock'){
   const item=data.stock.find((i:any)=>i.lot_id===b.lotId);if(!item||item.quantity_on_hand+b.delta<0)return bad('Invalid stock quantity');item.quantity_on_hand+=b.delta;return ok();
  }
  if(b.action==='request_restock'){
   data.restockRequests.push({id:crypto.randomUUID(),stock_item_id:b.stockItemId,stock_item_name:'TEST Gloves',unit:'boxes',quantity:b.quantity,reason:b.reason,transaction_type:'restock_requested',performed_at:stamp()});return ok();
  }
  if(b.action==='approve_restock'||b.action==='fulfill_restock'){
   const request=data.restockRequests.find((r:any)=>r.id===b.requestId);if(!admin||!request)return bad('No editable request');
   request.transaction_type=b.action==='approve_restock'?'restock_approved':'restock_fulfilled';return ok();
  }
  return bad(`Unimplemented fixture action: ${b.action}`,409);
 }
 if(url.startsWith('/api/operations')||url.startsWith('/api/digital-twin'))return Response.json(data);
 if(url.startsWith('/api/suite-context'))return Response.json({configured:true,department:{id:'fixture',name:'FICTIONAL TEST DEPARTMENT'},apparatus:data.apparatus.map((r:any)=>({...r,unit_name:r.name,unit_type:r.asset_type,call_sign:r.name})),events:[]});
 if(url.startsWith('/api/dashboard'))return Response.json({viewer:{employeeId:'fixture-member'}});
 if(url.startsWith('/api/permissions'))return Response.json({viewerPermissions:['inventory.view','inventory.check',...(admin?['inventory.repairs.manage','inventory.setup.manage']:[])],identity:'fixture:member',confirmation:{required:false,version:null,exempt:false},employees:[{id:'fixture-member',name:'Fictional crew'}]});
 return bad('Unknown fixture endpoint',404);
};
const reportError=(message:string)=>{const target=document.getElementById('audit-errors');if(target)target.textContent+=message;};
window.addEventListener('error',e=>reportError(e.message));
window.addEventListener('unhandledrejection',e=>reportError(String(e.reason)));
createRoot(document.getElementById('root')!).render(<><aside style={{padding:8,background:'#fff4be',color:'#172b3b',font:'14px Arial'}}>FICTIONAL LOCAL TEST ONLY · no real inspections saved<br/><span id="audit-writes">Test writes: 0</span><label><input id="fail-save" type="checkbox"/>Fail next save</label><button onClick={()=>{sessionStorage.removeItem(key);location.reload();}}>Reset fictional test records</button><span id="audit-errors" role="alert"/></aside><Inventory departmentId="fixture" departmentName="FICTIONAL TEST DEPARTMENT" permissions={admin?['inventory.check','inventory.repairs.manage','inventory.setup.manage']:['inventory.check']}/></>);
