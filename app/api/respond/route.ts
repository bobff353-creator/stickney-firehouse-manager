import { ensureDatabase } from "../../../db/bootstrap";
import { chicagoOperationalContext } from "../../operational-day";
import { distanceFeet, normalizeResponseAddress, rankPreplanMatch, suggestedStickneyBoxCard } from "../../respond-match";
import { normalizeApparatusUnit, respondingUnitsIncludeUnit } from "../../respond-device";
import { hasPermission } from "../../server-permissions";
import { matchCadToRoom } from "../../preplans/cad-room-match.ts";
import type { PreplanLevel } from "../../preplans/levels.ts";
import type { PreplanSpace } from "../../preplans/spaces.ts";
import { sortAlertsForRespond, visibleInRespond, type PreplanAlert } from "../../preplans/alerts.ts";
import { sortHazmatBySeverity, type HazmatRecord } from "../../preplans/hazmat.ts";
import { sortZonesBySeverity, type HazmatZone } from "../../preplans/hazmat-zones.ts";
import { classifyRisk, effectiveClassification, sortFactorsBySeverity, type RiskFactor, type RiskOverride } from "../../preplans/risk.ts";

type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const allowed = await hasPermission(request, db, "field_preplans.view");
    if (!allowed) return Response.json({ error: "Field response access is required." }, { status: 403 });

    const apparatus = normalizeApparatusUnit(new URL(request.url).searchParams.get("apparatus"));
    await db.prepare("UPDATE dispatch_incidents SET active=0,cleared_at=COALESCE(cleared_at,CURRENT_TIMESTAMP) WHERE active=1 AND EXISTS (SELECT 1 FROM daily_log_calls WHERE daily_log_calls.report_number=dispatch_incidents.incident_id AND trim(daily_log_calls.time_in)<>'')").run();
    const activeDispatches = await db.prepare("SELECT incident_id reportNumber,call_type callType,category,address,city,narrative,responding_units respondingUnits,longitude,latitude,dispatched_at dispatchedAt,time_out timeOut,source_system source,received_at receivedAt FROM dispatch_incidents WHERE active=1 AND cleared_at IS NULL AND datetime(dispatched_at)>=datetime('now','-12 hours') ORDER BY datetime(dispatched_at) DESC LIMIT 24").all<Row>();
    let activeCall = activeDispatches.results.find((call) => respondingUnitsIncludeUnit(call.respondingUnits, apparatus)) ?? null;
    if (!activeCall) {
      const date = chicagoOperationalContext().operationalDate;
      const dailyLogCalls = await db.prepare("SELECT report_number reportNumber,call_type callType,'' category,address,'' city,'' narrative,responding_units respondingUnits,NULL longitude,NULL latitude,log_date dispatchedAt,time_out timeOut,'Daily Log' source,log_date receivedAt FROM daily_log_calls WHERE log_date=? AND trim(time_out)<>'' AND trim(time_in)='' ORDER BY sort_order DESC LIMIT 24").bind(date).all<Row>();
      activeCall = dailyLogCalls.results.find((call) => respondingUnitsIncludeUnit(call.respondingUnits, apparatus)) ?? null;
    }
    const recentRows = await db.prepare("SELECT report_number reportNumber,call_type callType,address,responding_units respondingUnits,time_out timeOut,time_in timeIn,log_date logDate FROM daily_log_calls WHERE trim(time_in)<>'' ORDER BY log_date DESC,sort_order DESC LIMIT 6").all<Row>();
    const recentCalls = recentRows.results;
    if (!activeCall) return Response.json({ activeCall: null, preplan: null, match: null, roomMatch: null, cadUpdates: [], recentCalls, boxCard: null, nearestHydrants: [], apparatusFilter: apparatus || null, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });

    const planRows = await db.prepare("SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,footprint_square_feet footprintSquareFeet,floor_count floorCount,construction_type constructionType,suggested_fire_flow_gpm suggestedFireFlowGpm,suggested_fire_flow_duration suggestedFireFlowDuration,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,COALESCE(target_hazard,0) targetHazard,COALESCE(NULLIF(target_hazard_reasons,''),'[]') targetHazardReasons,COALESCE(NULLIF(risk_override_classification,''),'') riskOverrideClassification,risk_reviewed_by riskReviewedBy,risk_reviewed_at riskReviewedAt,updated_at updatedAt FROM field_preplans WHERE COALESCE(NULLIF(lifecycle_status,''),'published')='published' ORDER BY updated_at DESC").all<Row>();
    const plans = planRows.results.map((row) => ({
      ...row,
      address: String(row.address || ""),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      footprint: parseJson(row.footprint, []),
    }));
    const matched = rankPreplanMatch({
      address: String(activeCall.address || ""),
      latitude: activeCall.latitude == null ? null : Number(activeCall.latitude),
      longitude: activeCall.longitude == null ? null : Number(activeCall.longitude),
    }, plans);
    let preplan: Row | null = null;
    let roomMatch: ReturnType<typeof matchCadToRoom> | null = null;
    if (matched) {
      const [features, photos, levelRows, spaceRows, alertRows, hazmatRows, hazmatZoneRows, riskFactorRows] = await Promise.all([
        db.prepare("SELECT id,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details FROM field_preplan_features WHERE preplan_id=? ORDER BY created_at").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos WHERE preplan_id=? ORDER BY created_at DESC").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,name,short_label shortLabel,layer_type layerType,floor_index floorIndex,grade,sort_order sortOrder,is_default isDefault,respond_visible respondVisible,hidden FROM field_preplan_levels WHERE preplan_id=? AND respond_visible=1 AND hidden=0 ORDER BY sort_order").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,level_id levelId,display_name displayName,room_number roomNumber,space_type spaceType,aliases,cad_keywords cadKeywords,geometry,label_position labelPosition FROM field_preplan_spaces WHERE preplan_id=? ORDER BY display_name COLLATE NOCASE").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,level_id levelId,alert_type alertType,title,instructions,severity,display_order displayOrder,pin_to_respond pinToRespond,effective_at effectiveAt,expires_at expiresAt,verification_required verificationRequired,verified_by verifiedBy,verified_at verifiedAt,archived FROM field_preplan_alerts WHERE preplan_id=? AND archived=0 ORDER BY display_order").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,level_id levelId,mapped,chemical_name chemicalName,un_na_number unNaNumber,erg_guide_number ergGuideNumber,quantity,quantity_unit quantityUnit,container_type containerType,physical_state physicalState,exact_location exactLocation,nfpa_health nfpaHealth,nfpa_flammability nfpaFlammability,nfpa_instability nfpaInstability,nfpa_special nfpaSpecial,sds_asset_id sdsAssetId,date_verified dateVerified,verified_by verifiedBy,notes FROM field_preplan_hazmat WHERE preplan_id=?").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,level_id levelId,hazmat_id hazmatId,zone_type zoneType,shape,label,center_lat centerLat,center_lng centerLng,radius_feet radiusFeet,polygon FROM field_preplan_hazmat_zones WHERE preplan_id=?").bind(String(matched.plan.id)).all<Row>(),
        db.prepare("SELECT id,preplan_id preplanId,factor_key factorKey,score,explanation,source FROM field_preplan_risk_factors WHERE preplan_id=? ORDER BY score DESC").bind(String(matched.plan.id)).all<Row>(),
      ]);
      const levels = levelRows.results.map((row) => ({
        id: String(row.id), preplanId: String(row.preplanId), name: String(row.name), shortLabel: String(row.shortLabel),
        layerType: row.layerType, floorIndex: Number(row.floorIndex), grade: row.grade, sortOrder: Number(row.sortOrder),
        isDefault: Boolean(row.isDefault), respondVisible: Boolean(row.respondVisible), hidden: Boolean(row.hidden),
        backgroundType: "none", backgroundAssetKey: null, backgroundTransform: "{}", createdBy: "", updatedBy: "",
      })) as unknown as PreplanLevel[];
      const spaces = spaceRows.results.map((row) => ({
        id: String(row.id), preplanId: String(row.preplanId), levelId: String(row.levelId), displayName: String(row.displayName),
        roomNumber: String(row.roomNumber || ""), spaceType: row.spaceType,
        aliases: parseJson<string[]>(row.aliases, []), cadKeywords: parseJson<string[]>(row.cadKeywords, []),
        geometry: parseJson(row.geometry, []), labelPosition: row.labelPosition ? parseJson(row.labelPosition, null) : null,
        typicalOccupancy: null, peakOccupancy: null, specialPopulationNotes: "", accessNotes: "", fireProtectionNotes: "", hazards: "",
        createdBy: "", updatedBy: "",
      })) as unknown as PreplanSpace[];
      roomMatch = matchCadToRoom(String(activeCall.narrative || ""), spaces, levels);
      const alertsRaw = alertRows.results.map((row) => ({
        ...row, pinToRespond: Boolean(row.pinToRespond), verificationRequired: Boolean(row.verificationRequired), archived: Boolean(row.archived),
      })) as unknown as PreplanAlert[];
      const alerts = sortAlertsForRespond(visibleInRespond(alertsRaw));
      const hazmatRaw = hazmatRows.results.map((row) => ({ ...row, mapped: Boolean(row.mapped) })) as unknown as HazmatRecord[];
      const hazmat = sortHazmatBySeverity(hazmatRaw);
      const hazmatZonesRaw = hazmatZoneRows.results.map((row) => ({ ...row, polygon: parseJson(row.polygon, []) })) as unknown as HazmatZone[];
      const hazmatZones = sortZonesBySeverity(hazmatZonesRaw);
      const riskFactorsRaw = riskFactorRows.results as unknown as RiskFactor[];
      const riskFactors = sortFactorsBySeverity(riskFactorsRaw);
      const overrideClassificationRaw = String((matched.plan as {riskOverrideClassification?:string}).riskOverrideClassification || "");
      const riskOverride: RiskOverride | null = overrideClassificationRaw
        ? { classification: overrideClassificationRaw as RiskOverride["classification"], reviewedBy: String((matched.plan as {riskReviewedBy?:string}).riskReviewedBy || ""), reviewedAt: String((matched.plan as {riskReviewedAt?:string}).riskReviewedAt || "") }
        : null;
      const riskClassification = effectiveClassification(riskFactors, riskOverride);
      const computedRiskClassification = classifyRisk(riskFactors);
      preplan = {
        ...matched.plan,
        features: features.results,
        photos: photos.results.map((photo) => ({ ...photo, url: `/api/field-preplans/photos/${photo.id}` })),
        levels,
        spaces,
        alerts,
        hazmat,
        hazmatZones,
        riskFactors,
        riskClassification,
        computedRiskClassification,
        targetHazard: Boolean((matched.plan as {targetHazard?:number}).targetHazard),
        targetHazardReasons: JSON.parse(String((matched.plan as {targetHazardReasons?:string}).targetHazardReasons || "[]")),
      };
    }

    const receiptRows = String(activeCall.reportNumber || "")
      ? await db.prepare("SELECT event_type eventType,normalized_payload normalizedPayload,status,received_at receivedAt FROM cad_inbound_receipts WHERE external_incident_id=? ORDER BY datetime(received_at) DESC LIMIT 8").bind(String(activeCall.reportNumber)).all<Row>()
      : { results: [] as Row[] };
    const cadUpdates = receiptRows.results.map((row) => {
      const normalized = parseJson<Row>(row.normalizedPayload, {});
      return {
        eventType: row.eventType,
        status: row.status,
        receivedAt: row.receivedAt,
        narrative: normalized.narrative || normalized.notes || "",
        respondingUnits: normalized.respondingUnits || normalized.units || "",
      };
    });
    if (!cadUpdates.length && (activeCall.narrative || activeCall.respondingUnits)) {
      cadUpdates.push({ eventType: "Current dispatch", status: "processed", receivedAt: activeCall.receivedAt, narrative: activeCall.narrative || "", respondingUnits: activeCall.respondingUnits || "" });
    }
    const [boxRows, hydrantRows] = await Promise.all([
      db.prepare("SELECT id,title,address,box_number boxNumber,access_notes accessNotes,status,department FROM box_cards WHERE status='Active' ORDER BY updated_at DESC").all<Row>(),
      db.prepare("SELECT id,hydrant_number hydrantNumber,address,latitude,longitude,service_status serviceStatus FROM field_hydrants").all<Row>(),
    ]);
    const callAddress = normalizeResponseAddress(String(activeCall.address || ""));
    const point = activeCall.latitude != null && activeCall.longitude != null
      ? { latitude:Number(activeCall.latitude), longitude:Number(activeCall.longitude) }
      : matched ? { latitude:Number(matched.plan.latitude), longitude:Number(matched.plan.longitude) } : null;
    const suggestedBoxCardId = suggestedStickneyBoxCard({
      callType: activeCall.callType,
      category: activeCall.category,
      address: activeCall.address,
      longitude: point?.longitude,
    });
    const boxCard = (suggestedBoxCardId
      ? boxRows.results.find((card) => card.id === suggestedBoxCardId && card.department === "Stickney")
      : undefined)
      ?? (callAddress ? boxRows.results.find((card) => normalizeResponseAddress(String(card.address || "")) === callAddress) : undefined)
      ?? null;
    const nearestHydrants = point ? hydrantRows.results.map((hydrant) => ({
      ...hydrant,
      distanceFeet:Math.round(distanceFeet(point,{latitude:Number(hydrant.latitude),longitude:Number(hydrant.longitude)})),
    })).toSorted((a,b)=>a.distanceFeet-b.distanceFeet).slice(0,3) : [];

    return Response.json({
      activeCall,
      preplan,
      match: matched ? { method: matched.method, distanceFeet: Math.round(matched.distanceFeet) } : null,
      roomMatch,
      cadUpdates,
      recentCalls,
      boxCard,
      nearestHydrants,
      apparatusFilter: apparatus || null,
      generatedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the response workspace." }, { status: 500 });
  }
}
