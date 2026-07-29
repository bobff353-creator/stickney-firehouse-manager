import { ensureDatabase } from "../../../db/bootstrap";
import {
  emptyIncidentCommandState,
  normalizeIncidentCommandState,
  parseRespondingUnits,
  reduceIncidentCommandState,
  tacticalLevels,
  type CommandAction,
} from "../../incident-command-state";
import { chicagoOperationalContext } from "../../operational-day";
import { rankPreplanMatch } from "../../respond-match";
import { hasPermission } from "../../server-permissions";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type Row = Record<string, unknown>;
type ActiveIncident = {
  incidentId: string; reportNumber: string; callType: string; address: string; city: string; respondingUnits: string;
  longitude: number | null; latitude: number | null; dispatchedAt: string; source: string; receivedAt: string;
};

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}

async function activeIncident(db: Db): Promise<ActiveIncident | null> {
  await db.prepare("UPDATE dispatch_incidents SET active=0,cleared_at=COALESCE(cleared_at,CURRENT_TIMESTAMP) WHERE active=1 AND EXISTS (SELECT 1 FROM daily_log_calls WHERE daily_log_calls.report_number=dispatch_incidents.incident_id AND trim(daily_log_calls.time_in)<>'')").run();
  const dispatch = await db.prepare("SELECT incident_id incidentId,incident_id reportNumber,call_type callType,address,city,responding_units respondingUnits,longitude,latitude,dispatched_at dispatchedAt,source_system source,received_at receivedAt FROM dispatch_incidents WHERE active=1 AND cleared_at IS NULL AND datetime(dispatched_at)>=datetime('now','-12 hours') ORDER BY datetime(dispatched_at) DESC LIMIT 1").first<ActiveIncident>();
  if (dispatch) return dispatch;
  const date = chicagoOperationalContext().operationalDate;
  const logCall = await db.prepare("SELECT report_number reportNumber,call_type callType,address,'' city,responding_units respondingUnits,NULL longitude,NULL latitude,log_date dispatchedAt,'Daily Log' source,log_date receivedAt FROM daily_log_calls WHERE log_date=? AND trim(time_out)<>'' AND trim(time_in)='' ORDER BY sort_order DESC LIMIT 1").bind(date).first<Omit<ActiveIncident, "incidentId">>();
  return logCall ? { ...logCall, incidentId: `daily-log:${date}:${logCall.reportNumber || "unreported"}` } : null;
}

async function personnel(db: Db) {
  const rows = await db.prepare("SELECT e.id,e.name,p.label rank FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id WHERE e.active=1 ORDER BY e.name COLLATE NOCASE").all<{ id: string; name: string; rank: string }>();
  return rows.results;
}

async function actorName(request: Request, db: Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email ? await db.prepare("SELECT e.name FROM employees e JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{ name: string }>() : null;
  return employee?.name || email || "Authenticated user";
}

async function matchedPreplan(db: Db, incident: ActiveIncident) {
  const rows = await db.prepare("SELECT id,business_name businessName,address,latitude,longitude,floor_count floorCount,construction,access_info accessInfo,knox_box knoxBox,alarm_system alarmSystem,riser,fdc,sprinkler_system sprinklerSystem,status,updated_at updatedAt FROM field_preplans ORDER BY updated_at DESC").all<Row>();
  const plans = rows.results.map((row) => ({ ...row, address: String(row.address || ""), latitude: Number(row.latitude), longitude: Number(row.longitude) }));
  const match = rankPreplanMatch({ address: incident.address, latitude: incident.latitude, longitude: incident.longitude }, plans);
  return match ? { ...match.plan, match: { method: match.method, distanceFeet: Math.round(match.distanceFeet) } } : null;
}

function stale(receivedAt: string) {
  const timestamp = Date.parse(receivedAt);
  return !Number.isFinite(timestamp) || Date.now() - timestamp > 10 * 60 * 1000;
}

async function responseData(request: Request, db: Db) {
  const incident = await activeIncident(db);
  const [people, canManage] = await Promise.all([personnel(db), hasPermission(request, db, "incident_command.manage")]);
  if (!incident) {
    return {
      incident: null, preplan: null, personnel: people, cadUnits: [], state: null, events: [], canManage,
      connection: { status: "awaiting_incident", label: "Awaiting CAD data", stale: false, lastUpdatedAt: null },
      generatedAt: new Date().toISOString(),
    };
  }
  const [preplan, boardRow, eventRows] = await Promise.all([
    matchedPreplan(db, incident),
    db.prepare("SELECT board_state boardState,revision,updated_by updatedBy,updated_at updatedAt FROM incident_command_boards WHERE incident_id=?").bind(incident.incidentId).first<Row>(),
    db.prepare("SELECT id,revision,event_type eventType,summary,actor,created_at createdAt FROM incident_command_events WHERE incident_id=? ORDER BY revision DESC LIMIT 30").bind(incident.incidentId).all<Row>(),
  ]);
  const state = normalizeIncidentCommandState(boardRow ? parseJson(boardRow.boardState, emptyIncidentCommandState()) : emptyIncidentCommandState());
  state.revision = Number(boardRow?.revision ?? state.revision);
  state.updatedBy = String(boardRow?.updatedBy ?? state.updatedBy);
  state.updatedAt = boardRow?.updatedAt ? String(boardRow.updatedAt) : state.updatedAt;
  const isStale = stale(incident.receivedAt);
  return {
    incident,
    preplan,
    personnel: people,
    cadUnits: parseRespondingUnits(incident.respondingUnits),
    state,
    events: eventRows.results,
    canManage,
    connection: {
      status: isStale ? "stale" : "connected",
      label: isStale ? `Stale data — last updated ${incident.receivedAt}` : `Connected to stored ${incident.source || "CAD"} feed`,
      stale: isStale,
      lastUpdatedAt: incident.receivedAt,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "incident_command.view")) return Response.json({ error: "Incident Command Board access is required." }, { status: 403 });
    return Response.json(await responseData(request, db), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the Incident Command Board." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "incident_command.manage")) return Response.json({ error: "Incident command permission is required." }, { status: 403 });
    const body = await request.json() as { incidentId?: string; expectedRevision?: number; mutation?: CommandAction };
    const incident = await activeIncident(db);
    if (!incident || body.incidentId !== incident.incidentId) return Response.json({ error: "The active incident changed. Refresh the board before continuing." }, { status: 409 });
    if (!body.mutation || typeof body.mutation !== "object") return Response.json({ error: "Select a valid command-board action." }, { status: 400 });

    const [people, preplan, boardRow, actor] = await Promise.all([
      personnel(db),
      matchedPreplan(db, incident),
      db.prepare("SELECT board_state boardState,revision FROM incident_command_boards WHERE incident_id=?").bind(incident.incidentId).first<Row>(),
      actorName(request, db),
    ]);
    const state = normalizeIncidentCommandState(boardRow ? parseJson(boardRow.boardState, emptyIncidentCommandState()) : emptyIncidentCommandState());
    state.revision = Number(boardRow?.revision ?? 0);
    if (Number(body.expectedRevision ?? -1) !== state.revision) return Response.json({ error: "The board changed on another device. It has been refreshed.", conflict: true }, { status: 409 });

    const cadUnits = parseRespondingUnits(incident.respondingUnits);
    const result = reduceIncidentCommandState(state, body.mutation, {
      actor,
      now: new Date().toISOString(),
      validPersonnel: new Set(people.map((person) => person.id)),
      validUnits: new Set(cadUnits),
      validLevels: new Set(tacticalLevels(state, preplan ? Number(preplan.floorCount) : null)),
    });
    const eventId = crypto.randomUUID();
    const writes = boardRow
      ? [
          db.prepare("UPDATE incident_command_boards SET board_state=?,revision=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE incident_id=? AND revision=?").bind(JSON.stringify(result.state), result.state.revision, actor, incident.incidentId, state.revision),
          db.prepare("INSERT INTO incident_command_events (id,incident_id,revision,event_type,summary,actor,event_payload,created_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)").bind(eventId, incident.incidentId, result.state.revision, result.eventType, result.summary, actor, JSON.stringify(body.mutation)),
        ]
      : [
          db.prepare("INSERT INTO incident_command_boards (incident_id,board_state,revision,updated_by,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)").bind(incident.incidentId, JSON.stringify(result.state), result.state.revision, actor),
          db.prepare("INSERT INTO incident_command_events (id,incident_id,revision,event_type,summary,actor,event_payload,created_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)").bind(eventId, incident.incidentId, result.state.revision, result.eventType, result.summary, actor, JSON.stringify(body.mutation)),
        ];
    await db.batch(writes);
    return Response.json({ ok: true, state: result.state, event: { id: eventId, revision: result.state.revision, eventType: result.eventType, summary: result.summary, actor } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update the Incident Command Board." }, { status: 400 });
  }
}
