import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank } from "../../permissions";
import { availableHydrantFlow, hydrantOutletFlow } from "../../hydrant-flow";

type Db=Awaited<ReturnType<typeof ensureDatabase>>;
const owners=["bobff353@gmail.com"];
async function access(request:Request,db:Db){
  const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()??"";
  const row=email?await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;isAdmin:number}>():null;
  const admin=owners.includes(email)||Boolean(row?.isAdmin);if(!row&&!admin)return{view:false,edit:false,actor:""};if(admin)return{view:true,edit:true,actor:row?.name||email};
  const [rankRows,overrides]=await Promise.all([db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(row!.rank).all<{permissionKey:string;allowed:number}>(),db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(row!.id).all<{permissionKey:string;effect:"allow"|"deny"}>()]);
  const set=new Set(rankRows.results.length?rankRows.results.filter((item)=>item.allowed).map((item)=>item.permissionKey):defaultPermissionsForRank(row!.rank));for(const item of overrides.results){if(item.effect==="allow")set.add(item.permissionKey);else set.delete(item.permissionKey);}
  return{view:set.has("field_preplans.view"),edit:set.has("field_preplans.edit"),actor:row!.name};
}
const txt=(value:unknown,max=1000)=>String(value??"").trim().slice(0,max);
const num=(value:unknown)=>Number(value);
const validCoordinate=(lat:number,lng:number)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;

export async function GET(request:Request){
  try{const db=await ensureDatabase(),auth=await access(request,db);if(!auth.view)return Response.json({error:"Field hydrant access is required."},{status:403});
    const [hydrants,flushes,tests]=await Promise.all([
      db.prepare("SELECT id,hydrant_number hydrantNumber,address,latitude,longitude,service_status serviceStatus,manufacturer,model,port_count portCount,port_sizes portSizes,notes,updated_by updatedBy,updated_at updatedAt FROM field_hydrants ORDER BY updated_at DESC").all(),
      db.prepare("SELECT id,hydrant_id hydrantId,flushed_at flushedAt,flushed_by flushedBy,water_clear waterClear,issues,notes FROM field_hydrant_flushes ORDER BY flushed_at DESC").all(),
      db.prepare("SELECT t.id,t.test_hydrant_id testHydrantId,t.flow_hydrant_id flowHydrantId,f.hydrant_number flowHydrantNumber,t.tested_at testedAt,t.static_pressure staticPressure,t.residual_pressure residualPressure,t.desired_residual desiredResidual,t.outlet_diameter outletDiameter,t.pitot_pressure pitotPressure,t.discharge_coefficient dischargeCoefficient,t.measured_flow measuredFlow,t.available_flow availableFlow,t.tested_by testedBy,t.notes FROM field_hydrant_flow_tests t LEFT JOIN field_hydrants f ON f.id=t.flow_hydrant_id ORDER BY t.tested_at DESC").all(),
    ]);
    return Response.json({canEdit:auth.edit,hydrants:hydrants.results.map((item)=>({...item,portSizes:JSON.parse(String((item as {portSizes:string}).portSizes||"[]")),flushes:flushes.results.filter((row)=>(row as {hydrantId:string}).hydrantId===(item as {id:string}).id),flowTests:tests.results.filter((row)=>(row as {testHydrantId:string}).testHydrantId===(item as {id:string}).id)}))});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load hydrants."},{status:500});}
}

export async function POST(request:Request){
  try{const db=await ensureDatabase(),auth=await access(request,db);if(!auth.edit)return Response.json({error:"Field hydrant edit permission is required."},{status:403});const body=await request.json() as Record<string,unknown>,action=txt(body.action,40);
    if(action==="deleteHydrant"){const id=txt(body.id,80),confirmation=txt(body.confirmation,20);if(!id||confirmation!=="DELETE")return Response.json({error:"Confirm Delete is required before a hydrant can be removed."},{status:400});
      const existing=await db.prepare("SELECT id FROM field_hydrants WHERE id=?").bind(id).first<{id:string}>();
      if(!existing)return Response.json({error:"Hydrant not found."},{status:404});
      await db.prepare("DELETE FROM field_hydrant_flow_tests WHERE test_hydrant_id=? OR flow_hydrant_id=?").bind(id,id).run();
      await db.prepare("DELETE FROM field_hydrant_flushes WHERE hydrant_id=?").bind(id).run();
      await db.prepare("DELETE FROM field_hydrants WHERE id=?").bind(id).run();
      return Response.json({ok:true,id});}
    if(action==="saveHydrant"){const id=txt(body.id,80)||crypto.randomUUID(),lat=num(body.latitude),lng=num(body.longitude),count=num(body.portCount),sizes=Array.isArray(body.portSizes)?body.portSizes.map((item)=>txt(item,20)).filter(Boolean).slice(0,3):[];if(!validCoordinate(lat,lng)||!Number.isInteger(count)||count<0||count>3)return Response.json({error:"Current GPS location and an unknown, one, two, or three-port layout are required."},{status:400});
      await db.prepare("INSERT INTO field_hydrants(id,hydrant_number,address,latitude,longitude,service_status,manufacturer,model,port_count,port_sizes,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET hydrant_number=excluded.hydrant_number,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,service_status=excluded.service_status,manufacturer=excluded.manufacturer,model=excluded.model,port_count=excluded.port_count,port_sizes=excluded.port_sizes,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,txt(body.hydrantNumber,80),txt(body.address,240),lat,lng,body.serviceStatus==="out_of_service"?"out_of_service":"in_service",txt(body.manufacturer,120),txt(body.model,120),count,JSON.stringify(sizes),txt(body.notes),auth.actor,auth.actor).run();return Response.json({ok:true,id});}
    if(action==="addFlush"){const hydrantId=txt(body.hydrantId,80),flushedAt=txt(body.flushedAt,40);if(!hydrantId||Number.isNaN(Date.parse(flushedAt)))return Response.json({error:"Choose a hydrant and flushing date."},{status:400});await db.prepare("INSERT INTO field_hydrant_flushes(id,hydrant_id,flushed_at,flushed_by,water_clear,issues,notes) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),hydrantId,new Date(flushedAt).toISOString(),auth.actor,body.waterClear?1:0,txt(body.issues),txt(body.notes)).run();return Response.json({ok:true});}
    if(action==="addFlowTest"){const testHydrantId=txt(body.testHydrantId,80),flowHydrantId=txt(body.flowHydrantId,80),testedAt=txt(body.testedAt,40),staticPressure=num(body.staticPressure),residualPressure=num(body.residualPressure),desiredResidual=num(body.desiredResidual),outletDiameter=num(body.outletDiameter),pitotPressure=num(body.pitotPressure),coefficient=num(body.dischargeCoefficient);
      const measuredFlow=hydrantOutletFlow(outletDiameter,pitotPressure,coefficient),availableFlow=availableHydrantFlow(measuredFlow,staticPressure,residualPressure,desiredResidual);
      if(!testHydrantId||!flowHydrantId||testHydrantId===flowHydrantId||Number.isNaN(Date.parse(testedAt))||!measuredFlow||!availableFlow||![.7,.8,.9].includes(coefficient))return Response.json({error:"Record different test and flow hydrants, a valid date, static pressure above residual pressure, desired residual below static pressure, outlet size, pitot pressure, and an approved coefficient."},{status:400});
      await db.prepare("INSERT INTO field_hydrant_flow_tests(id,test_hydrant_id,flow_hydrant_id,tested_at,static_pressure,residual_pressure,desired_residual,outlet_diameter,pitot_pressure,discharge_coefficient,measured_flow,available_flow,tested_by,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),testHydrantId,flowHydrantId,new Date(testedAt).toISOString(),staticPressure,residualPressure,desiredResidual,outletDiameter,pitotPressure,coefficient,measuredFlow,availableFlow,auth.actor,txt(body.notes)).run();return Response.json({ok:true,measuredFlow,availableFlow});}
    return Response.json({error:"Unsupported hydrant action."},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to save hydrant."},{status:500});}
}
