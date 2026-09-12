import React from 'react';
import {createRoot} from 'react-dom/client';
import Inventory from '../../app/inventory-live';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
import '../../app/admin-usability.css';
import '../../app/inventory/inventory.css';
import '../../app/inventory/usability.css';
import '../../app/inventory/air-systems.css';
import '../../app/inventory/service-schedule.css';
import '../../app/suite-theme.css';

const rig={id:'fixture-engine',name:'Preview Engine',asset_type:'engine',status:'in_service'};
const location={id:'fixture-cabinet',apparatus_id:rig.id,label:'Driver side · rear equipment cabinet',side:'driver',sort_order:1};
const item={id:'fixture-radio',apparatus_id:rig.id,compartment_id:location.id,compartment_label:location.label,name:'Portable radio with spare battery and charging cable',quantity_required:2,check_types:['daily','inventory'],equipment_category:'equipment',response_type:'pass_fail',service_status:'in_service',barcode:'PREVIEW-ONLY',manufacturer:'Test',model:'Fixture',item_order:1};
const equipment=[item,{...item,id:'fixture-mileage',name:'Current mileage / odometer',response_type:'mileage',quantity_required:1,item_order:0}];
const checks=[{id:'fixture-check',apparatus_id:rig.id,apparatus_name:rig.name,check_type:'daily',status:'in_progress',started_at:new Date().toISOString(),started_by:'Preview crew'}];
const data={configured:true,apparatus:[rig,{...rig,id:'fixture-ambulance',name:'Preview Ambulance',asset_type:'ambulance'}],compartments:[location],equipment,retiredEquipment:[],checks,checkItems:equipment.map(e=>({...e,id:`result-${e.id}`,equipment_id:e.id,equipment_name:e.name,check_id:checks[0].id,result:'pending'})),exceptions:[],workOrders:[],workOrderDocuments:[],inspectionSchedules:[{id:'fixture-schedule',apparatus_id:rig.id,apparatus_name:rig.name,check_type:'inventory',day_of_week:1,start_time:'06:00',end_time:'12:00',active:true}],stock:[],restockRequests:[],locationChanges:[],scbaTemplates:[{id:'fixture-scba',apparatus_id:rig.id,active:true,pack_positions:['Officer seat','Rear seat'],include_rit:true,spare_bottle_count:1}],scbaEntries:[]};
let writes=0;
const audit={data,permissionMode:'ok',permissionRequests:0,emptySave:false,requests:[] as string[],errors:[] as string[],permissions:null as string[]|null};
Object.assign(window,{inventoryAudit:audit});
window.fetch=async(input,init)=>{
 const url=String(input); if(!url.startsWith('/api/'))throw Error('Fixture blocks external fetch');
 audit.requests.push(url);
 if(init?.method==='POST'){
  const body=JSON.parse(String(init.body)); writes++;document.getElementById('audit-writes')!.textContent=`Test writes: ${writes} · ${body.action}`;
  if((document.getElementById('fail-save') as HTMLInputElement).checked){(document.getElementById('fail-save') as HTMLInputElement).checked=false;return Response.json({error:'Simulated save failure. Your edits were not saved.'},{status:503});}
  if(body.action==='update_equipment'){const target=data.equipment.find(e=>e.id===body.equipmentId)!;Object.assign(target,{name:body.name,quantity_required:Number(body.quantityRequired),check_types:body.checkTypes,response_type:body.responseType,barcode:body.barcode});return Response.json({ok:true});}
  if(body.action==='record_check_item'){if(audit.emptySave){audit.emptySave=false;return Response.json({checkItems:[]});}const target=data.checkItems.find(e=>e.id===body.checkItemId)!;Object.assign(target,{result:body.result,numeric_reading:body.numericReading,checked_at:new Date().toISOString(),checked_by:'Preview member'});return Response.json({checkItems:[target]});}
  if(body.action==='complete_check'){Object.assign(data.checks[0],{status:'completed',review_status:'pending',completed_at:new Date().toISOString()});return Response.json({ok:true});}
  return Response.json({error:'This fixture does not save that action.'},{status:409});
 }
 if(url.startsWith('/api/operations'))return Response.json(data);
 if(url.startsWith('/api/digital-twin'))return Response.json({...data,photos:[],hotspots:[]});
 if(url.startsWith('/api/suite-context'))return Response.json({configured:true,department:{id:'fixture',name:'Preview department'},apparatus:data.apparatus.map(r=>({...r,unit_name:r.name,unit_type:r.asset_type,call_sign:r.name})),events:[]});
 if(url.startsWith('/api/dashboard'))return Response.json({viewer:{employeeId:'fixture-member'}});
 if(url.startsWith('/api/permissions')){
  audit.permissionRequests++;
  if(audit.permissionMode==='timeout')throw new DOMException('signal timed out','TimeoutError');
  if(audit.permissionMode==='denied')return Response.json({error:'Inventory access was removed.'},{status:403});
  return Response.json({viewerPermissions:audit.permissions??['dashboard.view','documents.view','field_preplans.view','scheduling.view','payroll.view_own','inventory.view','inventory.check',...(admin?['operations_board.view','employees.manage','settings.manage','inventory.repairs.manage','inventory.setup.manage']:[])],identity:'fixture:member',confirmation:{required:false,version:null,exempt:false},employees:[{id:'fixture-member',name:'Preview member'}]});
 }
 return Response.json({error:'Unknown fixture request'},{status:404});
};
window.addEventListener('error',e=>{audit.errors.push(e.message);const target=document.getElementById('audit-errors');if(target)target.textContent+=e.message;});
window.addEventListener('unhandledrejection',e=>{audit.errors.push(String(e.reason));const target=document.getElementById('audit-errors');if(target)target.textContent+=String(e.reason);});
const admin=new URLSearchParams(window.location.search).get('role')!=='member';
const startInCheck=new URLSearchParams(window.location.search).has('check');
createRoot(document.getElementById('root')!).render(<><aside style={{padding:8,background:'#fff4be',font:'12px Arial'}}>Fictional audit only · <span id="audit-writes">Test writes: 0</span><label><input id="fail-save" type="checkbox"/>Fail next save</label><span id="audit-errors"/></aside><Inventory departmentId="fixture" departmentName="Preview department" initialApparatusId={startInCheck?rig.id:''} initialCheckType={startInCheck?'daily':''} permissions={admin?['inventory.check','inventory.repairs.manage','inventory.setup.manage']:['inventory.check']}/></>);
