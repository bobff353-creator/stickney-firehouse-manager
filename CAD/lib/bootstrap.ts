// Database bootstrap: create tables and seed the first dispatcher.
//
// Runs at most once per process (idempotent CREATE TABLE IF NOT EXISTS). The
// first boot seeds an admin dispatcher from CAD_ADMIN_* env vars so the app is
// immediately usable.

import { batch, get, run } from "./db";
import { hashPassword } from "./auth";

let ready = false;
let initializing: Promise<void> | null = null;

async function initialize(): Promise<void> {
  await batch([
    { sql: "CREATE TABLE IF NOT EXISTS dispatchers (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'dispatcher', password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_units (id TEXT PRIMARY KEY NOT NULL, unit_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', unit_type TEXT NOT NULL DEFAULT 'engine', agency TEXT NOT NULL DEFAULT 'Local', station TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'available', status_since TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, active_incident_id TEXT NOT NULL DEFAULT '', latitude REAL, longitude REAL, heading REAL, speed REAL, location_at TEXT, home_latitude REAL, home_longitude REAL, source TEXT NOT NULL DEFAULT 'manual', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_units_active_status_idx ON cad_units(active, status)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_unit_location_history (id TEXT PRIMARY KEY NOT NULL, unit_id TEXT NOT NULL, unit_number TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL, longitude REAL NOT NULL, heading REAL, speed REAL, recorded_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT '')" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_unit_location_history_idx ON cad_unit_location_history(unit_id, recorded_at)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_incidents (incident_id TEXT PRIMARY KEY NOT NULL, call_type TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', narrative TEXT NOT NULL DEFAULT '', responding_units TEXT NOT NULL DEFAULT '', longitude REAL, latitude REAL, dispatched_at TEXT NOT NULL, time_out TEXT NOT NULL DEFAULT '', source_system TEXT NOT NULL DEFAULT 'Local', source_payload TEXT NOT NULL DEFAULT '{}', received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cleared_at TEXT, active INTEGER NOT NULL DEFAULT 1)" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_incidents_active_idx ON cad_incidents(active, dispatched_at)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_incident_notes (id TEXT PRIMARY KEY NOT NULL, incident_id TEXT NOT NULL, sequence INTEGER NOT NULL, note TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'note', author TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'local', agency TEXT NOT NULL DEFAULT '', unit_number TEXT NOT NULL DEFAULT '', external_id TEXT NOT NULL DEFAULT '', event_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_incident_notes_incident_idx ON cad_incident_notes(incident_id, sequence)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_agencies (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, agency_type TEXT NOT NULL DEFAULT 'cad', contact TEXT NOT NULL DEFAULT '', inbound_token TEXT NOT NULL DEFAULT '', outbound_url TEXT NOT NULL DEFAULT '', outbound_secret TEXT NOT NULL DEFAULT '', subscriptions TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, last_inbound_at TEXT, last_outbound_at TEXT, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_outbound_deliveries (id TEXT PRIMARY KEY NOT NULL, agency_id TEXT NOT NULL DEFAULT '', agency_name TEXT NOT NULL DEFAULT '', event_type TEXT NOT NULL DEFAULT '', incident_id TEXT NOT NULL DEFAULT '', endpoint TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', status_code INTEGER, error TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT)" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_outbound_deliveries_idx ON cad_outbound_deliveries(agency_id, created_at)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_alarm_panels (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, monitor_account TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', latitude REAL, longitude REAL, protocol TEXT NOT NULL DEFAULT 'webhook', inbound_token TEXT NOT NULL DEFAULT '', auto_create_incident INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, last_signal_at TEXT, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)" },
    { sql: "CREATE TABLE IF NOT EXISTS cad_alarm_events (id TEXT PRIMARY KEY NOT NULL, panel_id TEXT NOT NULL, panel_name TEXT NOT NULL DEFAULT '', external_event_id TEXT NOT NULL DEFAULT '', signal_type TEXT NOT NULL DEFAULT 'alarm', zone TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'high', latitude REAL, longitude REAL, incident_id TEXT NOT NULL DEFAULT '', event_at TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, raw_payload TEXT NOT NULL DEFAULT '{}', acknowledged_at TEXT, acknowledged_by TEXT NOT NULL DEFAULT '')" },
    { sql: "CREATE INDEX IF NOT EXISTS cad_alarm_events_panel_idx ON cad_alarm_events(panel_id, received_at)" },
  ]);
  await seedAdmin();
}

async function seedAdmin(): Promise<void> {
  const existing = await get<{ count: number }>("SELECT COUNT(*) AS count FROM dispatchers");
  if (Number(existing?.count ?? 0) > 0) return;
  const email = (process.env.CAD_ADMIN_EMAIL?.trim() || "admin@example.com").toLowerCase();
  const password = process.env.CAD_ADMIN_PASSWORD?.trim() || "changeme";
  const name = process.env.CAD_ADMIN_NAME?.trim() || "Dispatch Administrator";
  const { salt, hash } = await hashPassword(password);
  await run(
    "INSERT INTO dispatchers (id, email, name, role, password_salt, password_hash) VALUES (?, ?, ?, 'admin', ?, ?) ON CONFLICT(email) DO NOTHING",
    [crypto.randomUUID(), email, name, salt, hash],
  );
}

/** Ensure the schema exists and the seed admin is present. Safe to call on every request. */
export async function ensureDatabase(): Promise<void> {
  if (ready) return;
  initializing ??= initialize().then(() => { ready = true; }).finally(() => { initializing = null; });
  await initializing;
}
