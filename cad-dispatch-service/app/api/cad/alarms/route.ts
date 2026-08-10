import { ensureDatabase } from "../../../../lib/bootstrap";
import { query, run } from "../../../../lib/db";
import { getSession } from "../../../../lib/auth";

const jsonHeaders = { "cache-control": "no-store" } as const;

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

async function requireAdmin(request: Request) {
  const session = await getSession(request);
  return session && session.role === "admin" ? session : null;
}

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    if (!(await requireAdmin(request))) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const [panels, events] = await Promise.all([
      query("SELECT id, name, monitor_account AS monitorAccount, address, latitude, longitude, protocol, inbound_token AS inboundToken, auto_create_incident AS autoCreateIncident, active, last_signal_at AS lastSignalAt FROM cad_alarm_panels ORDER BY name"),
      query("SELECT id, panel_id AS panelId, panel_name AS panelName, signal_type AS signalType, zone, description, priority, incident_id AS incidentId, event_at AS eventAt, received_at AS receivedAt, acknowledged_at AS acknowledgedAt, acknowledged_by AS acknowledgedBy FROM cad_alarm_events ORDER BY datetime(received_at) DESC LIMIT 50"),
    ]);
    return Response.json({ signalUrl: new URL("/api/cad/alarms/signal", request.url).toString(), panels, events }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load alarm panels." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const admin = await requireAdmin(request);
    if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "createPanel");
    const actor = admin.name || admin.email;

    if (action === "createPanel") {
      const name = String(body.name ?? "").trim();
      if (!name) return Response.json({ error: "A panel name is required." }, { status: 422 });
      const id = crypto.randomUUID();
      const inboundToken = newToken();
      await run(
        "INSERT INTO cad_alarm_panels (id, name, monitor_account, address, latitude, longitude, inbound_token, auto_create_incident, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, String(body.monitorAccount ?? "").trim(), String(body.address ?? "").trim(), Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null, Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null, inboundToken, body.autoCreateIncident === false ? 0 : 1, actor],
      );
      return Response.json({ ok: true, id, inboundToken }, { headers: jsonHeaders });
    }

    const id = String(body.id ?? "").trim();
    if (!id) return Response.json({ error: "A panel or event id is required." }, { status: 422 });

    if (action === "updatePanel") {
      await run(
        "UPDATE cad_alarm_panels SET name = COALESCE(?, name), monitor_account = COALESCE(?, monitor_account), address = COALESCE(?, address), latitude = ?, longitude = ?, auto_create_incident = COALESCE(?, auto_create_incident), active = COALESCE(?, active), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [body.name === undefined ? null : String(body.name).trim(), body.monitorAccount === undefined ? null : String(body.monitorAccount).trim(), body.address === undefined ? null : String(body.address).trim(), Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null, Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null, body.autoCreateIncident === undefined ? null : (body.autoCreateIncident ? 1 : 0), body.active === undefined ? null : (body.active ? 1 : 0), id],
      );
      return Response.json({ ok: true, id }, { headers: jsonHeaders });
    }

    if (action === "rotatePanel") {
      const inboundToken = newToken();
      await run("UPDATE cad_alarm_panels SET inbound_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [inboundToken, id]);
      return Response.json({ ok: true, id, inboundToken }, { headers: jsonHeaders });
    }

    if (action === "deletePanel") {
      await run("DELETE FROM cad_alarm_events WHERE panel_id = ?", [id]);
      await run("DELETE FROM cad_alarm_panels WHERE id = ?", [id]);
      return Response.json({ ok: true, id }, { headers: jsonHeaders });
    }

    if (action === "acknowledge") {
      const result = await run("UPDATE cad_alarm_events SET acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = ? WHERE id = ? AND acknowledged_at IS NULL", [actor, id]);
      return Response.json({ ok: Boolean(result.changes), id }, { headers: jsonHeaders });
    }

    return Response.json({ error: "Unknown alarm action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update alarm panels." }, { status: 500 });
  }
}
