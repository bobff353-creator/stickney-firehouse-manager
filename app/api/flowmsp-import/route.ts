import { ensureDatabase } from "../../../db/bootstrap";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type HydrantImport = {
  flowId?:unknown; hydrantId?:unknown; displayAddress?:unknown; latitude?:unknown; longitude?:unknown;
  inService?:unknown; flowGpm?:unknown; flowRange?:unknown; notes?:unknown;
};
type PreplanImport = {
  flowId?:unknown; row?:unknown; name?:unknown; address1?:unknown; address2?:unknown; city?:unknown; state?:unknown; zip?:unknown;
  doNotShare?:unknown; matchCategory?:unknown; portalRecordId?:unknown; [key:string]:unknown;
};

const owners = new Set(["bobff353@gmail.com"]);
const sourceFile = "Stickney Fire Department Preplan Report 09_01_2026.csv";
const text = (value:unknown, limit=2000) => String(value ?? "").trim().slice(0, limit);
const number = (value:unknown) => { if(value===null||value===undefined||text(value)==="")return Number.NaN;const result=Number(value); return Number.isFinite(result)?result:Number.NaN; };
const uuid = (value:unknown) => { const result=text(value,80).toLowerCase(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)?result:""; };
const truthy = (value:unknown) => value===true || text(value,20).toUpperCase()==="TRUE";
const validCoordinate = (lat:number,lng:number) => lat>=-90&&lat<=90&&lng>=-180&&lng<=180;

async function isAdmin(request:Request,db:Db) {
  const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()??"";
  if(owners.has(email)) return email;
  const row=email?await db.prepare("SELECT e.name,COALESCE(ep.is_admin,0) isAdmin FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{name:string;isAdmin:number}>():null;
  return row?.isAdmin?row.name:"";
}

function hydrantNote(item:HydrantImport,flowId:string) {
  const details=[
    `Imported from FlowMSP on ${new Date().toISOString().slice(0,10)}; source export 2026-09-01. Needs field verification.`,
    `FlowMSP source ID: ${flowId}.`,
    "Original FlowMSP GPS coordinates retained; the provider-generated address is display-only.",
  ];
  const gpm=number(item.flowGpm);if(Number.isFinite(gpm)&&gpm>0)details.push(`FlowMSP reported flow: ${Math.round(gpm)} GPM${text(item.flowRange,20)?` (${text(item.flowRange,20)})`:""}.`);
  if(text(item.notes))details.push(text(item.notes,1200));
  return text(details.join(" "),2000);
}

function fullAddress(item:PreplanImport) {
  const street=[text(item.address1,180),text(item.address2,120)].filter(Boolean).join(" ");
  const region=[text(item.city,80),[text(item.state,40),text(item.zip,20)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street,region].filter(Boolean).join(", ");
}

export async function POST(request:Request) {
  try {
    const db=await ensureDatabase(),actor=await isAdmin(request,db);
    if(!actor)return Response.json({error:"Administrator privileges are required for a FlowMSP import."},{status:403});
    const body=await request.json() as Record<string,unknown>;
    if(text(body.action,40)!=="importFlowMspPreview")return Response.json({error:"Unsupported FlowMSP import action."},{status:400});
    const hydrants=Array.isArray(body.hydrants)?body.hydrants as HydrantImport[]:[];
    const preplans=Array.isArray(body.preplans)?body.preplans as PreplanImport[]:[];
    if(hydrants.length>300||preplans.length>150)return Response.json({error:"The import batch exceeds the reviewed preview limits."},{status:400});

    // Schema/index changes belong to the reviewed migration, never the query gateway.
    const targetCounts=new Map<string,number>();
    for(const item of preplans){
      const candidate=text(item.portalRecordId,100);
      if(candidate&&text(item.matchCategory,100).startsWith("Strong "))targetCounts.set(candidate,(targetCounts.get(candidate)??0)+1);
    }

    let hydrantsImported=0,hydrantsRejected=0,hydrantsSkipped=0;
    for(let index=0;index<hydrants.length;index+=40){
      const statements=[];
      for(const item of hydrants.slice(index,index+40)){
        const id=uuid(item.flowId),lat=number(item.latitude),lng=number(item.longitude);
        if(!id||!validCoordinate(lat,lng)){hydrantsRejected+=1;continue;}
        const existing=await db.prepare("SELECT id FROM field_hydrants WHERE id=?").bind(id).first<{id:string}>();
        if(existing){hydrantsSkipped+=1;continue;}
        statements.push(db.prepare("INSERT INTO field_hydrants(id,hydrant_number,address,latitude,longitude,service_status,manufacturer,model,port_count,port_sizes,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
          .bind(id,text(item.hydrantId,80),text(item.displayAddress,240),lat,lng,truthy(item.inService)?"in_service":"out_of_service","","",0,"[]",hydrantNote(item,id),actor,actor));
        hydrantsImported+=1;
      }
      if(statements.length)await db.batch(statements);
    }

    let preplansQueued=0,preplansLinked=0,preplansMerged=0,preplansRejected=0,preplansSkipped=0;
    for(const item of preplans){
      const externalId=uuid(item.flowId);
      if(!externalId||truthy(item.doNotShare)){preplansRejected+=1;continue;}
      const imported=await db.prepare("SELECT id FROM field_preplan_imports WHERE source_external_id=? OR id=?").bind(externalId,`flowmsp-${externalId}`).first<{id:string}>();
      if(imported){preplansSkipped+=1;continue;}
      const category=text(item.matchCategory,100),candidateId=text(item.portalRecordId,100);
      const uniqueTarget=targetCounts.get(candidateId)===1;
      const payload=JSON.stringify({...item,importReviewStatus:"Imported - needs verification",...(!uniqueTarget&&candidateId?{importReviewReason:"Multiple source records or uncertain matching; preserved separately for review."}:{})});
      if(category==="Strong live preplan candidate"&&candidateId&&uniqueTarget){
        const plan=await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(candidateId).first<{id:string}>();
        if(plan){
          await db.prepare("INSERT INTO field_preplan_imports(id,business_name,address,source_file,source_row,source_external_id,source_payload,status,linked_preplan_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_external_id=excluded.source_external_id,source_payload=excluded.source_payload,status='completed',linked_preplan_id=excluded.linked_preplan_id,updated_at=CURRENT_TIMESTAMP")
            .bind(`flowmsp-${externalId}`,text(item.name,180)||"Unnamed FlowMSP preplan",fullAddress(item),sourceFile,Math.trunc(number(item.row)||0),externalId,payload,"completed",candidateId).run();
          preplansLinked+=1;continue;
        }
      }
      if(category==="Strong import-queue candidate"&&candidateId&&uniqueTarget){
        const existing=await db.prepare("SELECT id,source_external_id sourceExternalId FROM field_preplan_imports WHERE id=?").bind(candidateId).first<{id:string;sourceExternalId:string}>();
        if(existing&&(!existing.sourceExternalId||existing.sourceExternalId===externalId)){
          await db.prepare("UPDATE field_preplan_imports SET source_external_id=?,source_payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(externalId,payload,candidateId).run();
          preplansMerged+=1;continue;
        }
      }
      await db.prepare("INSERT INTO field_preplan_imports(id,business_name,address,source_file,source_row,source_external_id,source_payload,status) VALUES(?,?,?,?,?,?,?,'location_required') ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,address=excluded.address,source_external_id=excluded.source_external_id,source_payload=excluded.source_payload,updated_at=CURRENT_TIMESTAMP")
        .bind(`flowmsp-${externalId}`,text(item.name,180)||"Unnamed FlowMSP preplan",fullAddress(item),sourceFile,Math.trunc(number(item.row)||0),externalId,payload).run();
      preplansQueued+=1;
    }
    return Response.json({ok:true,hydrantsImported,hydrantsRejected,hydrantsSkipped,preplansQueued,preplansLinked,preplansMerged,preplansRejected,preplansSkipped});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Unable to import FlowMSP records."},{status:500});
  }
}
