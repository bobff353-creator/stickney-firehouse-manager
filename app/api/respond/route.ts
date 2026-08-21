import { ensureDatabase } from "../../../db/bootstrap";
import { chicagoOperationalContext } from "../../operational-day";
import {
  distanceFeet,
  normalizeResponseAddress,
  rankPreplanMatch,
  suggestedStickneyBoxCard,
} from "../../respond-match";
import {
  normalizeApparatusUnit,
  respondingUnitsIncludeUnit,
} from "../../respond-device";
import { hasPermission } from "../../server-permissions";
import { isOperationallyVisible, matchCadRoom } from "../../preplans/domain";
import { constructionProfile, occupancyProfile } from "../../preplans/profiles";

type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value || "")) as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const allowed = await hasPermission(request, db, "field_preplans.view");
    if (!allowed)
      return Response.json(
        { error: "Field response access is required." },
        { status: 403 },
      );

    const apparatus = normalizeApparatusUnit(
      new URL(request.url).searchParams.get("apparatus"),
    );
    await db
      .prepare(
        "UPDATE dispatch_incidents SET active=0,cleared_at=COALESCE(cleared_at,CURRENT_TIMESTAMP) WHERE active=1 AND EXISTS (SELECT 1 FROM daily_log_calls WHERE trim(daily_log_calls.report_number)=trim(dispatch_incidents.incident_id) AND trim(daily_log_calls.time_in)<>'')",
      )
      .run();
    const activeDispatches = await db
      .prepare(
        "SELECT incident_id reportNumber,call_type callType,category,address,city,narrative,responding_units respondingUnits,longitude,latitude,dispatched_at dispatchedAt,time_out timeOut,source_system source,received_at receivedAt FROM dispatch_incidents WHERE active=1 AND cleared_at IS NULL AND datetime(dispatched_at)>=datetime('now','-12 hours') AND NOT EXISTS (SELECT 1 FROM daily_log_calls WHERE trim(daily_log_calls.report_number)=trim(dispatch_incidents.incident_id) AND trim(daily_log_calls.time_in)<>'') ORDER BY datetime(dispatched_at) DESC LIMIT 24",
      )
      .all<Row>();
    let activeCall =
      activeDispatches.results.find((call) =>
        respondingUnitsIncludeUnit(call.respondingUnits, apparatus),
      ) ?? null;
    if (!activeCall) {
      const date = chicagoOperationalContext().operationalDate;
      const dailyLogCalls = await db
        .prepare(
          "SELECT report_number reportNumber,call_type callType,'' category,address,'' city,'' narrative,responding_units respondingUnits,NULL longitude,NULL latitude,log_date dispatchedAt,time_out timeOut,'Daily Log' source,log_date receivedAt FROM daily_log_calls WHERE log_date=? AND trim(time_out)<>'' AND trim(time_in)='' ORDER BY sort_order DESC LIMIT 24",
        )
        .bind(date)
        .all<Row>();
      activeCall =
        dailyLogCalls.results.find((call) =>
          respondingUnitsIncludeUnit(call.respondingUnits, apparatus),
        ) ?? null;
    }
    const recentRows = await db
      .prepare(
        "SELECT report_number reportNumber,call_type callType,address,responding_units respondingUnits,time_out timeOut,time_in timeIn,log_date logDate FROM daily_log_calls WHERE trim(time_in)<>'' ORDER BY log_date DESC,sort_order DESC LIMIT 6",
      )
      .all<Row>();
    const recentCalls = recentRows.results;
    if (!activeCall)
      return Response.json(
        {
          activeCall: null,
          preplan: null,
          match: null,
          cadUpdates: [],
          recentCalls,
          boxCard: null,
          nearestHydrants: [],
          apparatusFilter: apparatus || null,
          generatedAt: new Date().toISOString(),
        },
        { headers: { "cache-control": "no-store" } },
      );

    const planRows = await db
      .prepare(
        "SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,footprint_square_feet footprintSquareFeet,floor_count floorCount,construction_type constructionType,suggested_fire_flow_gpm suggestedFireFlowGpm,suggested_fire_flow_duration suggestedFireFlowDuration,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,construction_profile constructionProfile,occupancy_profile occupancyProfile,updated_at updatedAt FROM field_preplans WHERE COALESCE(publication_status,'published')='published' ORDER BY updated_at DESC",
      )
      .all<Row>();
    const plans: Array<
      Row & {
        id: unknown;
        address: string;
        latitude: number;
        longitude: number;
        footprint: unknown[];
      }
    > = planRows.results.map((row) => ({
      ...row,
      id: row.id,
      address: String(row.address || ""),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      footprint: parseJson(row.footprint, []),
    }));
    const matched = rankPreplanMatch(
      {
        address: String(activeCall.address || ""),
        latitude:
          activeCall.latitude == null ? null : Number(activeCall.latitude),
        longitude:
          activeCall.longitude == null ? null : Number(activeCall.longitude),
      },
      plans,
    );
    let preplan: Row | null = null;
    let operational: Row | null = null;
    if (matched) {
      const [features, photos] = await Promise.all([
        db
          .prepare(
            "SELECT id,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details,primary_level_id primaryLevelId,verified_at verifiedAt,updated_at updatedAt FROM field_preplan_features WHERE preplan_id=? ORDER BY created_at",
          )
          .bind(String(matched.plan.id))
          .all<Row>(),
        db
          .prepare(
            "SELECT id,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos WHERE preplan_id=? ORDER BY created_at DESC",
          )
          .bind(String(matched.plan.id))
          .all<Row>(),
      ]);
      preplan = {
        ...matched.plan,
        features: features.results,
        photos: photos.results.map((photo) => ({
          ...photo,
          url: `/api/field-preplans/photos/${photo.id}`,
        })),
      };
      try {
        const preplanId = String(matched.plan.id);
        const [levels, spaces, alerts, hazmat, hoseLays, assets, revision] =
          await Promise.all([
            db
              .prepare(
                "SELECT id,name,short_label shortLabel,layer_type layerType,sort_order sortOrder,is_default isDefault FROM field_preplan_levels WHERE preplan_id=? AND archived=0 AND respond_visible=1 ORDER BY sort_order,name",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT id,level_id levelId,display_name name,aliases,space_type spaceType FROM field_preplan_spaces WHERE preplan_id=? AND archived=0 ORDER BY display_name",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT id,level_id levelId,space_id spaceId,title,instructions message,severity,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction FROM field_preplan_alerts WHERE preplan_id=? AND archived=0 AND pin_to_respond=1 ORDER BY severity DESC,created_at DESC",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT id,level_id levelId,space_id spaceId,un_na_number unNumber,chemical_name materialName,erg_guide_number ergGuideNumber,quantity,quantity_unit quantityUnit,physical_state physicalState,container_type storageType,notes,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction FROM field_preplan_hazmat WHERE preplan_id=? AND archived=0 ORDER BY chemical_name",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT id,level_id levelId,name,total_distance_feet totalDistanceFeet,hose_size_inches hoseSizeInches,recommended_hose_feet recommendedHoseFeet,supply_line_label supplyLineLabel,apparatus_capacity_feet apparatusCapacityFeet,notes FROM field_preplan_hose_lays WHERE preplan_id=? AND archived=0 ORDER BY name",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT id,level_id levelId,category,original_filename filename,mime_type contentType,caption,pin_to_respond pinToRespond,created_at createdAt FROM field_preplan_assets WHERE preplan_id=? AND archived=0 ORDER BY pin_to_respond DESC,sort_order,created_at DESC",
              )
              .bind(preplanId)
              .all<Row>(),
            db
              .prepare(
                "SELECT revision_number revisionNumber,created_at publishedAt FROM field_preplan_revisions WHERE preplan_id=? AND publication_status='published' ORDER BY revision_number DESC LIMIT 1",
              )
              .bind(preplanId)
              .first<Row>(),
          ]);
        const roomCandidates = spaces.results.map((space) => ({
          id: String(space.id),
          name: String(space.name),
          aliases: parseJson<string[]>(space.aliases, []),
          levelId: String(space.levelId || ""),
        }));
        operational = {
          levels: levels.results,
          spaces: spaces.results,
          alerts: alerts.results.filter((item) =>
            isOperationallyVisible({
              effectiveAt: String(item.effectiveAt || ""),
              expiresAt: String(item.expiresAt || ""),
              expirationAction: item.expirationAction as never,
            }),
          ),
          hazmat: hazmat.results.filter((item) =>
            isOperationallyVisible({
              effectiveAt: String(item.effectiveAt || ""),
              expiresAt: String(item.expiresAt || ""),
              expirationAction: item.expirationAction as never,
            }),
          ),
          hoseLays: hoseLays.results,
          assets: assets.results,
          construction: constructionProfile(matched.plan.constructionProfile),
          occupancy: occupancyProfile(matched.plan.occupancyProfile),
          revision,
          roomMatch: matchCadRoom(
            `${activeCall.narrative || ""} ${activeCall.address || ""}`,
            roomCandidates,
          ),
        };
      } catch {
        operational = null;
      }
    }

    const receiptRows = String(activeCall.reportNumber || "")
      ? await db
          .prepare(
            "SELECT event_type eventType,normalized_payload normalizedPayload,status,received_at receivedAt FROM cad_inbound_receipts WHERE external_incident_id=? ORDER BY datetime(received_at) DESC LIMIT 8",
          )
          .bind(String(activeCall.reportNumber))
          .all<Row>()
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
    if (
      !cadUpdates.length &&
      (activeCall.narrative || activeCall.respondingUnits)
    ) {
      cadUpdates.push({
        eventType: "Current dispatch",
        status: "processed",
        receivedAt: activeCall.receivedAt,
        narrative: activeCall.narrative || "",
        respondingUnits: activeCall.respondingUnits || "",
      });
    }
    const [boxRows, hydrantRows] = await Promise.all([
      db
        .prepare(
          "SELECT id,title,address,box_number boxNumber,access_notes accessNotes,status,department FROM box_cards WHERE status='Active' ORDER BY updated_at DESC",
        )
        .all<Row>(),
      db
        .prepare(
          "SELECT id,hydrant_number hydrantNumber,address,latitude,longitude,service_status serviceStatus FROM field_hydrants",
        )
        .all<Row>(),
    ]);
    const callAddress = normalizeResponseAddress(
      String(activeCall.address || ""),
    );
    const point =
      activeCall.latitude != null && activeCall.longitude != null
        ? {
            latitude: Number(activeCall.latitude),
            longitude: Number(activeCall.longitude),
          }
        : matched
          ? {
              latitude: Number(matched.plan.latitude),
              longitude: Number(matched.plan.longitude),
            }
          : null;
    const suggestedBoxCardId = suggestedStickneyBoxCard({
      callType: activeCall.callType,
      category: activeCall.category,
      address: activeCall.address,
      longitude: point?.longitude,
    });
    const boxCard =
      (suggestedBoxCardId
        ? boxRows.results.find(
            (card) =>
              card.id === suggestedBoxCardId && card.department === "Stickney",
          )
        : undefined) ??
      (callAddress
        ? boxRows.results.find(
            (card) =>
              normalizeResponseAddress(String(card.address || "")) ===
              callAddress,
          )
        : undefined) ??
      null;
    const nearestHydrants = point
      ? hydrantRows.results
          .map((hydrant) => ({
            ...hydrant,
            distanceFeet: Math.round(
              distanceFeet(point, {
                latitude: Number(hydrant.latitude),
                longitude: Number(hydrant.longitude),
              }),
            ),
          }))
          .toSorted((a, b) => a.distanceFeet - b.distanceFeet)
          .slice(0, 3)
      : [];

    return Response.json(
      {
        activeCall,
        preplan,
        operational,
        match: matched
          ? {
              method: matched.method,
              distanceFeet: Math.round(matched.distanceFeet),
            }
          : null,
        cadUpdates,
        recentCalls,
        boxCard,
        nearestHydrants,
        apparatusFilter: apparatus || null,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the response workspace.",
      },
      { status: 500 },
    );
  }
}
