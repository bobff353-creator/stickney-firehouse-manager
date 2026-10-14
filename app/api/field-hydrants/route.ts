import { permissionsForEmail } from "../../server-permissions";
import { ensureDatabase } from "../../../db/bootstrap";
import { availableHydrantFlow, hydrantOutletFlow } from "../../hydrant-flow";
import { changeHydrantArchive,saveHydrantProfile } from '../../hydrant-lifecycle';

type Db=Awaited<ReturnType<typeof ensureDatabase>>;
async function access(request: Request, db: Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const permissions = await permissionsForEmail(email, db);
  return { view: permissions.has("field_preplans.view"), edit: permissions.has("field_preplans.edit"), actor: email };
}
const txt=(value:unknown,max=1000)=>String(value??"").trim().slice(0,max);
const num=(value:unknown)=>Number(value);
const validCoordinate=(lat:number,lng:number)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;

export async function GET(request:Request){
  try{const db=await ensureDatabase(),auth=await access(request,db);if(!auth.view)return Response.json({error:"Field hydrant access is required."},{status:403});
    const [hydrants,flushes,tests]=await Promise.all([
      db.prepare("SELECT id,hydrant_number hydrantNumber,address,latitude,longitude,service_status serviceStatus,manufacturer,model,port_count portCount,port_sizes portSizes,notes,updated_by updatedBy,updated_at updatedAt FROM field_hydrants WHERE (?=1 OR service_status<>'archived') ORDER BY updated_at DESC").bind(new URL(request.url).searchParams.get('includeArchived')==='1'?1:0).all(),
      db.prepare("SELECT id,hydrant_id hydrantId,flushed_at flushedAt,flushed_by flushedBy,water_clear waterClear,issues,notes FROM field_hydrant_flushes ORDER BY flushed_at DESC").all(),
      db.prepare("SELECT t.id,t.test_hydrant_id testHydrantId,t.flow_hydrant_id flowHydrantId,f.hydrant_number flowHydrantNumber,t.tested_at testedAt,t.static_pressure staticPressure,t.residual_pressure residualPressure,t.desired_residual desiredResidual,t.outlet_diameter outletDiameter,t.pitot_pressure pitotPressure,t.discharge_coefficient dischargeCoefficient,t.measured_flow measuredFlow,t.available_flow availableFlow,t.tested_by testedBy,t.notes FROM field_hydrant_flow_tests t LEFT JOIN field_hydrants f ON f.id=t.flow_hydrant_id ORDER BY t.tested_at DESC").all(),
    ]);
    return Response.json({canEdit:auth.edit,hydrants:hydrants.results.map((item)=>({...item,portSizes:JSON.parse(String((item as {portSizes:string}).portSizes||"[]")),flushes:flushes.results.filter((row)=>(row as {hydrantId:string}).hydrantId===(item as {id:string}).id),flowTests:tests.results.filter((row)=>(row as {testHydrantId:string}).testHydrantId===(item as {id:string}).id)}))},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load hydrants."},{status:500});}
}

export async function POST(request:Request){
  try{const db=await ensureDatabase(),auth=await access(request,db);if(!auth.edit)return Response.json({error:"Field hydrant edit permission is required."},{status:403});const body=await request.json() as Record<string,unknown>,action=txt(body.action,40);
    if(new URL(request.url).origin!==request.headers.get('origin'))return Response.json({error:'Open the hydrant record in this portal before saving.'},{status:403});
    if(action==='archiveHydrant'||action==='restoreHydrant'||action==='deleteHydrant'){
      const id=txt(body.id,80),restore=action==='restoreHydrant';
      if(!id||(!restore&&body.confirmation!=='ARCHIVE'&&!(action==='deleteHydrant'&&body.confirmation==='DELETE')))return Response.json({error:'Confirm Archive before removing a hydrant from active use.'},{status:400});
      // Older clients may still send deleteHydrant. That action now preserves history too.
      return Response.json({ok:true,...await changeHydrantArchive(db,id,auth.actor,restore)});
    }
    const targetId=txt(body.id??body.hydrantId??body.testHydrantId,80);
    if(targetId){const target=await db.prepare('SELECT service_status serviceStatus FROM field_hydrants WHERE id=?').bind(targetId).first<{serviceStatus:string}>();if(target?.serviceStatus==='archived')return Response.json({error:'This hydrant is archived. Restore it before recording new changes.'},{status:409});}
    if(action==="saveHydrant"){const id=txt(body.id,80),lat=num(body.latitude),lng=num(body.longitude),count=num(body.portCount),sizes=Array.isArray(body.portSizes)?body.portSizes.map((item)=>txt(item,20)).filter(Boolean).slice(0,3):[];if(!id)return Response.json({error:'Refresh this page before creating a hydrant so a retry can preserve its record ID. Keep a copy of your entered details first.'},{status:409});if(!validCoordinate(lat,lng)||!Number.isInteger(count)||count<0||count>3)return Response.json({error:"A valid map location and an unknown, one, two, or three-port layout are required."},{status:400});
      return Response.json({ok:true,...await saveHydrantProfile(db,{id,hydrantNumber:txt(body.hydrantNumber,80),address:txt(body.address,240),latitude:lat,longitude:lng,serviceStatus:body.serviceStatus==='out_of_service'?'out_of_service':'in_service',manufacturer:txt(body.manufacturer,120),model:txt(body.model,120),portCount:count,portSizes:sizes,notes:txt(body.notes)},auth.actor,txt(body.updatedAt,80))});}
    if(action==="addFlush"){const hydrantId=txt(body.hydrantId,80),flushedAt=txt(body.flushedAt,40);if(!hydrantId||Number.isNaN(Date.parse(flushedAt)))return Response.json({error:"Choose a hydrant and flushing date."},{status:400});await db.prepare("INSERT INTO field_hydrant_flushes(id,hydrant_id,flushed_at,flushed_by,water_clear,issues,notes) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),hydrantId,new Date(flushedAt).toISOString(),auth.actor,body.waterClear?1:0,txt(body.issues),txt(body.notes)).run();return Response.json({ok:true});}
    if(action==="addFlowTest"){const testHydrantId=txt(body.testHydrantId,80),flowHydrantId=txt(body.flowHydrantId,80),testedAt=txt(body.testedAt,40),staticPressure=num(body.staticPressure),residualPressure=num(body.residualPressure),desiredResidual=num(body.desiredResidual),outletDiameter=num(body.outletDiameter),pitotPressure=num(body.pitotPressure),coefficient=num(body.dischargeCoefficient);
      const measuredFlow=hydrantOutletFlow(outletDiameter,pitotPressure,coefficient),availableFlow=availableHydrantFlow(measuredFlow,staticPressure,residualPressure,desiredResidual);
      if(!testHydrantId||!flowHydrantId||testHydrantId===flowHydrantId||Number.isNaN(Date.parse(testedAt))||!measuredFlow||!availableFlow||![.7,.8,.9].includes(coefficient))return Response.json({error:"Record different test and flow hydrants, a valid date, static pressure above residual pressure, desired residual below static pressure, outlet size, pitot pressure, and an approved coefficient."},{status:400});
      const flowSource=await db.prepare("SELECT id FROM field_hydrants WHERE id=? AND service_status<>'archived'").bind(flowHydrantId).first();if(!flowSource)return Response.json({error:'Choose an active flow hydrant.'},{status:409});
      await db.prepare("INSERT INTO field_hydrant_flow_tests(id,test_hydrant_id,flow_hydrant_id,tested_at,static_pressure,residual_pressure,desired_residual,outlet_diameter,pitot_pressure,discharge_coefficient,measured_flow,available_flow,tested_by,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),testHydrantId,flowHydrantId,new Date(testedAt).toISOString(),staticPressure,residualPressure,desiredResidual,outletDiameter,pitotPressure,coefficient,measuredFlow,availableFlow,auth.actor,txt(body.notes)).run();return Response.json({ok:true,measuredFlow,availableFlow});}
    return Response.json({error:"Unsupported hydrant action."},{status:400});
  }catch(error){const message=error instanceof Error?error.message:'';return Response.json({error:message.includes('SAVE_CONFLICT')?'The hydrant changed in another tab. Refresh its saved record before retrying.':message==='Hydrant not found.'?message:'Save was not confirmed. Your entries remain on screen; retry after reconnecting.'},{status:message.includes('SAVE_CONFLICT')?409:message==='Hydrant not found.'?404:503});}
}
