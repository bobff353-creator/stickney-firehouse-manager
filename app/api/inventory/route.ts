import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";

const text = (value: unknown, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const email = (request: Request) => request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Verified user";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function audit(db: Awaited<ReturnType<typeof ensureDatabase>>, actor: string, action: string, type: string, id: string, summary: string) {
  await db.prepare("INSERT INTO inventory_audit_events(id,actor,action,record_type,record_id,summary) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor, action, type, id, summary).run();
}

export async function GET(request: Request) {
  const db = await ensureDatabase();
  if (!await hasPermission(request, db, "documents.view")) return json({ error: "Sign in with an authorized department account." }, 401);
  const [apparatus, compartments, equipment, photos, hotspots, readiness, events] = await db.batch([
    db.prepare("SELECT id,unit_number unitNumber,name,asset_type assetType,status,manufacturer,model,year,vin,notes,retired_at retiredAt,updated_at updatedAt FROM fleet_apparatus ORDER BY retired_at IS NOT NULL,unit_number"),
    db.prepare("SELECT id,apparatus_id apparatusId,label,side,details,sort_order sortOrder,updated_at updatedAt FROM inventory_compartments ORDER BY apparatus_id,sort_order,label"),
    db.prepare("SELECT id,apparatus_id apparatusId,compartment_id compartmentId,name,category,manufacturer,model,serial_number serialNumber,asset_number assetNumber,barcode,quantity,condition,service_status serviceStatus,expiration_date expirationDate,inspection_date inspectionDate,notes,retired_at retiredAt,updated_at updatedAt FROM inventory_equipment ORDER BY name"),
    db.prepare("SELECT id,apparatus_id apparatusId,compartment_id compartmentId,equipment_id equipmentId,photo_type photoType,filename,created_at createdAt FROM inventory_photos ORDER BY created_at DESC"),
    db.prepare("SELECT id,apparatus_id apparatusId,compartment_id compartmentId,photo_id photoId,x_basis_points xBasisPoints,y_basis_points yBasisPoints FROM inventory_hotspots ORDER BY created_at"),
    db.prepare("SELECT id,apparatus_id apparatusId,status,notes,checked_by checkedBy,checked_at checkedAt FROM inventory_readiness ORDER BY checked_at DESC LIMIT 100"),
    db.prepare("SELECT id,actor,action,record_type recordType,record_id recordId,summary,created_at createdAt FROM inventory_audit_events ORDER BY created_at DESC LIMIT 100"),
  ]);
  return json({ apparatus: apparatus.results, compartments: compartments.results, equipment: equipment.results, photos: photos.results, hotspots: hotspots.results, readiness: readiness.results, events: events.results });
}

export async function POST(request: Request) {
  const db = await ensureDatabase();
  if (!await hasPermission(request, db, "settings.manage")) return json({ error: "Your department role cannot change Inventory." }, 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Cross-site changes are not allowed." }, 403);
  const body = await request.json() as Record<string, unknown>;
  const action = text(body.action, 40), actor = email(request), id = text(body.id, 80) || crypto.randomUUID();
  try {
    if (action === "save_apparatus") {
      const unitNumber = text(body.unitNumber, 40), name = text(body.name, 120), assetType = text(body.assetType, 80);
      if (!unitNumber || !name) return json({ error: "Unit number and apparatus name are required." }, 400);
      const existing = await db.prepare("SELECT id FROM fleet_apparatus WHERE id=?").bind(id).first();
      if (existing) await db.prepare("UPDATE fleet_apparatus SET unit_number=?,name=?,asset_type=?,status=?,manufacturer=?,model=?,year=?,vin=?,notes=?,retired_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(unitNumber,name,assetType,text(body.status,40)||"in_service",text(body.manufacturer,120),text(body.model,120),Number(body.year)||null,text(body.vin,80),text(body.notes),body.retired?new Date().toISOString():null,actor,id).run();
      else await db.prepare("INSERT INTO fleet_apparatus(id,unit_number,name,asset_type,status,manufacturer,model,year,vin,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,unitNumber,name,assetType,text(body.status,40)||"in_service",text(body.manufacturer,120),text(body.model,120),Number(body.year)||null,text(body.vin,80),text(body.notes),actor,actor).run();
      await audit(db,actor,existing?"apparatus.updated":"apparatus.created","apparatus",id,`${unitNumber} ${name}`); return json({ id, saved: true });
    }
    if (action === "delete_apparatus") {
      const linked = await db.prepare("SELECT (SELECT COUNT(*) FROM inventory_compartments WHERE apparatus_id=?)+(SELECT COUNT(*) FROM inventory_equipment WHERE apparatus_id=?)+(SELECT COUNT(*) FROM inventory_readiness WHERE apparatus_id=?) count").bind(id,id,id).first<{count:number}>();
      if (Number(linked?.count)) return json({ error: "Retire this apparatus instead. Linked inventory history prevents deletion." }, 409);
      await db.prepare("DELETE FROM fleet_apparatus WHERE id=?").bind(id).run(); await audit(db,actor,"apparatus.deleted","apparatus",id,"Unlinked apparatus deleted"); return json({ deleted:true });
    }
    if (action === "save_compartment") {
      const apparatusId=text(body.apparatusId,80), label=text(body.label,120); if(!apparatusId||!label)return json({error:"Apparatus and compartment name are required."},400);
      const fleet=await db.prepare("SELECT id FROM fleet_apparatus WHERE id=? AND retired_at IS NULL").bind(apparatusId).first(); if(!fleet)return json({error:"Select an active Fleet apparatus."},404);
      const existing=await db.prepare("SELECT id FROM inventory_compartments WHERE id=?").bind(id).first();
      if(existing) await db.prepare("UPDATE inventory_compartments SET label=?,side=?,details=?,sort_order=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND apparatus_id=?").bind(label,text(body.side,40),text(body.details),Number(body.sortOrder)||0,actor,id,apparatusId).run();
      else await db.prepare("INSERT INTO inventory_compartments(id,apparatus_id,label,side,details,sort_order,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)").bind(id,apparatusId,label,text(body.side,40),text(body.details),Number(body.sortOrder)||0,actor,actor).run();
      await audit(db,actor,existing?"compartment.updated":"compartment.created","compartment",id,label); return json({id,saved:true});
    }
    if(action==="delete_compartment"){
      const linked=await db.prepare("SELECT (SELECT COUNT(*) FROM inventory_equipment WHERE compartment_id=?)+(SELECT COUNT(*) FROM inventory_hotspots WHERE compartment_id=?) count").bind(id,id).first<{count:number}>(); if(Number(linked?.count))return json({error:"Move linked equipment and remove hotspots before deleting this compartment."},409);
      await db.prepare("DELETE FROM inventory_photos WHERE compartment_id=?").bind(id).run(); await db.prepare("DELETE FROM inventory_compartments WHERE id=?").bind(id).run(); await audit(db,actor,"compartment.deleted","compartment",id,"Compartment deleted"); return json({deleted:true});
    }
    if(action==="save_equipment"){
      const apparatusId=text(body.apparatusId,80), compartmentId=text(body.compartmentId,80)||null, name=text(body.name,160); if(!apparatusId||!name)return json({error:"Apparatus and equipment name are required."},400);
      if(compartmentId){const match=await db.prepare("SELECT id FROM inventory_compartments WHERE id=? AND apparatus_id=?").bind(compartmentId,apparatusId).first();if(!match)return json({error:"Select a compartment on this apparatus."},400);}
      const values=[apparatusId,compartmentId,name,text(body.category,80),text(body.manufacturer,120),text(body.model,120),text(body.serialNumber,120),text(body.assetNumber,120),text(body.barcode,160),Math.max(1,Number(body.quantity)||1),text(body.condition,60)||"serviceable",text(body.serviceStatus,60)||"in_service",text(body.expirationDate,20),text(body.inspectionDate,20),text(body.notes),body.retired?new Date().toISOString():null,actor];
      const existing=await db.prepare("SELECT id FROM inventory_equipment WHERE id=?").bind(id).first();
      if(existing) await db.prepare("UPDATE inventory_equipment SET apparatus_id=?,compartment_id=?,name=?,category=?,manufacturer=?,model=?,serial_number=?,asset_number=?,barcode=?,quantity=?,condition=?,service_status=?,expiration_date=?,inspection_date=?,notes=?,retired_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...values,id).run();
      else await db.prepare("INSERT INTO inventory_equipment(id,apparatus_id,compartment_id,name,category,manufacturer,model,serial_number,asset_number,barcode,quantity,condition,service_status,expiration_date,inspection_date,notes,retired_at,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,...values,actor).run();
      await audit(db,actor,existing?"equipment.updated":"equipment.created","equipment",id,name); return json({id,saved:true});
    }
    if(action==="delete_equipment"){await db.prepare("UPDATE inventory_equipment SET retired_at=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor,id).run();await audit(db,actor,"equipment.retired","equipment",id,"Equipment retired with history preserved");return json({retired:true});}
    if(action==="save_hotspot"){
      const apparatusId=text(body.apparatusId,80),compartmentId=text(body.compartmentId,80),photoId=text(body.photoId,80); const x=Math.max(0,Math.min(10000,Number(body.xBasisPoints))),y=Math.max(0,Math.min(10000,Number(body.yBasisPoints)));
      const match=await db.prepare("SELECT c.id FROM inventory_compartments c JOIN inventory_photos p ON p.apparatus_id=c.apparatus_id WHERE c.id=? AND c.apparatus_id=? AND p.id=?").bind(compartmentId,apparatusId,photoId).first();if(!match)return json({error:"Choose an existing compartment and apparatus photo from the same unit."},400);
      await db.prepare("INSERT INTO inventory_hotspots(id,apparatus_id,compartment_id,photo_id,x_basis_points,y_basis_points,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET compartment_id=excluded.compartment_id,photo_id=excluded.photo_id,x_basis_points=excluded.x_basis_points,y_basis_points=excluded.y_basis_points,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(id,apparatusId,compartmentId,photoId,Math.round(x),Math.round(y),actor,actor).run();await audit(db,actor,"hotspot.saved","hotspot",id,"Digital twin hotspot saved");return json({id,saved:true});
    }
    if(action==="delete_hotspot"){await db.prepare("DELETE FROM inventory_hotspots WHERE id=?").bind(id).run();await audit(db,actor,"hotspot.deleted","hotspot",id,"Hotspot removed");return json({deleted:true});}
    if(action==="save_readiness"){const apparatusId=text(body.apparatusId,80),status=text(body.status,40);if(!apparatusId||!status)return json({error:"Apparatus and readiness status are required."},400);await db.prepare("INSERT INTO inventory_readiness(id,apparatus_id,status,notes,checked_by) VALUES(?,?,?,?,?)").bind(id,apparatusId,status,text(body.notes),actor).run();await audit(db,actor,"readiness.saved","readiness",id,status);return json({id,saved:true});}
    return json({error:"Unsupported Inventory action."},400);
  } catch (error) { const message=error instanceof Error&&error.message.includes("UNIQUE")?"That unit number or identifier already exists.":"The Inventory change could not be saved. Your entered information is still available; try again."; return json({error:message},503); }
}
