"use client";

import Image from "next/image";
import Link from "next/link";
import InventoryOperations from "./inventory-operations";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type View = "fleet" | "check" | "readiness" | "service" | "stock" | "setup";
type LoadState = "loading" | "ready" | "unavailable";
type FleetFilter = "all" | "in-service" | "out-impaired" | "digital-twins";

type SuiteDepartment = {
  id: string;
  name: string;
  slug?: string;
};

type SuiteApparatus = {
  id: string;
  unit_name: string;
  unit_type: string;
  call_sign: string;
  station: string;
  cad_unit_id: string;
  status: string;
  notes: string;
  updated_at: string;
};

type SuiteEvent = {
  id: string;
  source: string;
  event_type: string;
  record_id: string;
  status: string;
  occurred_at: string;
  created_at: string;
};

type SuiteContext = {
  configured: boolean;
  department: SuiteDepartment | null;
  apparatus: SuiteApparatus[];
  events: SuiteEvent[];
  error?: string;
};

type TwinApparatus = {
  id: string;
  name: string;
  asset_type: string;
  status: string;
  vin?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  weekly_due_day?: number | null;
};

type TwinCompartment = {
  id: string;
  apparatus_id: string;
  label: string;
  side: string;
  sort_order: number;
};

type TwinPhoto = {
  id: string;
  apparatus_id: string;
  compartment_id?: string;
  view_key: string;
  view_level: string;
  door_state: string;
  version_number: number;
  approval_status: string;
  captured_at: number;
  url: string;
};

type TwinHotspot = {
  id: string;
  photo_view_id: string;
  compartment_id: string;
  label: string;
  x_basis_points: number;
  y_basis_points: number;
};

type TwinData = {
  configured: boolean;
  apparatus: TwinApparatus[];
  compartments: TwinCompartment[];
  photos: TwinPhoto[];
  hotspots: TwinHotspot[];
  error?: string;
};

const emptyTwin: TwinData = {
  configured: false,
  apparatus: [],
  compartments: [],
  photos: [],
  hotspots: [],
};

const requiredPhotoViews = [
  ["driver", "closed", "Driver side - doors closed"],
  ["driver", "open", "Driver side - doors open"],
  ["officer", "closed", "Officer side - doors closed"],
  ["officer", "open", "Officer side - doors open"],
  ["front", "not_applicable", "Front / cab"],
  ["cab", "open", "Cab interior"],
  ["rear", "not_applicable", "Rear"],
  ["pump", "not_applicable", "Pump panel"],
  ["roof", "not_applicable", "Roof / ladder bed"],
] as const;

function text(value: unknown, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function apparatusRows(value: unknown): SuiteApparatus[] {
  return records(value).flatMap((item) => {
    const id = text(item.id, 80);
    if (!id) return [];
    return [{
      id,
      unit_name: text(item.unit_name),
      unit_type: text(item.unit_type, 100),
      call_sign: text(item.call_sign, 100),
      station: text(item.station, 160),
      cad_unit_id: text(item.cad_unit_id, 160),
      status: text(item.status, 80),
      notes: text(item.notes, 500),
      updated_at: text(item.updated_at, 80),
    }];
  });
}

function eventRows(value: unknown): SuiteEvent[] {
  return records(value).flatMap((item) => {
    const id = text(item.id, 80);
    if (!id) return [];
    return [{
      id,
      source: text(item.source, 80),
      event_type: text(item.event_type, 160),
      record_id: text(item.record_id, 160),
      status: text(item.status, 80),
      occurred_at: text(item.occurred_at, 80),
      created_at: text(item.created_at, 80),
    }];
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchingTwin(
  unit: SuiteApparatus | undefined,
  twins: TwinApparatus[],
) {
  if (!unit) return undefined;
  const identifiers = new Set(
    [unit.id, unit.call_sign, unit.unit_name]
      .map(normalize)
      .filter(Boolean),
  );
  return twins.find((twin) => (
    identifiers.has(normalize(twin.id))
    || identifiers.has(normalize(twin.name))
  ));
}

function titleCase(value: string, fallback = "Not recorded") {
  if (!value) return fallback;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  const normalized = normalize(status);
  if (["inservice", "active", "ready"].includes(normalized)) return "success";
  if (normalized.includes("outofservice") || normalized.includes("impaired")) {
    return "danger";
  }
  if (normalized) return "warning";
  return "neutral";
}

function formatDate(value: string | number | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function InventoryNavIcon({ view }: { view: Exclude<View, "setup"> }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="inventory-nav-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...common}>
    {view === "fleet" ? <><path d="M3 15V8h11l4 4h3v3"/><path d="M5 15h14M7 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM14 8v4h4"/></> : null}
    {view === "check" ? <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM8 12l2 2 5-5M8 18h8"/></> : null}
    {view === "readiness" ? <><path d="M12 3 3 20h18L12 3Z"/><path d="M12 9v5M12 17h.01"/></> : null}
    {view === "service" ? <><path d="m14 6 4-3 3 3-3 4-4-4ZM14 6 4 16v4h4L18 10"/><path d="m4 20-1 1"/></> : null}
    {view === "stock" ? <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></> : null}
  </svg>;
}

function StatePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`state-pill ${tone}`}>{children}</span>;
}

function OperationalState({
  title,
  kind = "empty",
  children,
  action,
}: {
  title: string;
  kind?: "empty" | "loading" | "unavailable";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={`operational-state ${kind}`} role={kind === "unavailable" ? "alert" : "status"}>
      <span>{kind === "loading" ? "LOADING" : kind === "unavailable" ? "UNAVAILABLE" : "NO RECORDS"}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export default function Inventory360({
  departmentId,
  departmentName,
  initialApparatusId = "",
  initialCheckType = "",
}: {
  departmentId: string;
  departmentName: string;
  initialApparatusId?: string;
  initialCheckType?: "daily" | "weekly" | "inventory" | "air_pack" | "";
}) {
  const [view, setView] = useState<View>(() => initialApparatusId && initialCheckType ? "check" : "fleet");
  const [selectedApparatusId, setSelectedApparatusId] = useState(initialApparatusId);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all");
  const [suiteState, setSuiteState] = useState<LoadState>("loading");
  const [suite, setSuite] = useState<SuiteContext>({
    configured: false,
    department: {
      id: departmentId,
      name: departmentName,
    },
    apparatus: [],
    events: [],
  });
  const [twinState, setTwinState] = useState<LoadState>("loading");
  const [twinData, setTwinData] = useState<TwinData>(emptyTwin);
  const [toast, setToast] = useState("");

  const loadTwin = useCallback(async (
    apparatusId?: string,
    signal?: AbortSignal,
  ) => {
    try {
      const query = apparatusId
        ? `?apparatusId=${encodeURIComponent(apparatusId)}`
        : "";
      const response = await fetch(`/api/digital-twin${query}`, {
        cache: "no-store",
        signal,
      });
      const data = await response.json().catch(() => ({})) as Partial<TwinData>;
      if (!response.ok || data.configured !== true) {
        setTwinData({
          ...emptyTwin,
          error: text(data.error, 500)
            || "Inventory storage is unavailable.",
        });
        setTwinState("unavailable");
        return;
      }
      setTwinData({
        configured: true,
        apparatus: Array.isArray(data.apparatus) ? data.apparatus : [],
        compartments: Array.isArray(data.compartments) ? data.compartments : [],
        photos: Array.isArray(data.photos) ? data.photos : [],
        hotspots: Array.isArray(data.hotspots) ? data.hotspots : [],
      });
      setTwinState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setTwinData({
        ...emptyTwin,
        error: "Inventory storage is unavailable.",
      });
      setTwinState("unavailable");
    }
  }, []);

  const loadSuite = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/suite-context", {
        cache: "no-store",
        signal,
      });
        const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok || payload.configured !== true) {
          throw new Error(
            text(payload.error, 500)
              || "Department apparatus could not be loaded.",
          );
        }
        const departmentRecord = record(payload.department);
        const apparatus = apparatusRows(payload.apparatus);
        setSuite({
          configured: true,
          department: departmentRecord ? {
            id: text(departmentRecord.id, 80) || departmentId,
            name: text(departmentRecord.name) || departmentName,
            slug: text(departmentRecord.slug, 160),
          } : {
            id: departmentId,
            name: departmentName,
          },
          apparatus,
          events: eventRows(payload.events),
        });
      setSuiteState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSuite((current) => ({
        ...current,
        configured: false,
        error: error instanceof Error
          ? error.message
          : "Department apparatus could not be loaded.",
      }));
      setSuiteState("unavailable");
    }
  }, [departmentId, departmentName]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSuite(controller.signal);
    void loadTwin(undefined, controller.signal);
    return () => controller.abort();
  }, [loadSuite, loadTwin]);

  const linkedTwinCount = suite.apparatus.filter((unit) => (
    Boolean(matchingTwin(unit, twinData.apparatus))
  )).length;
  const inService = suite.apparatus.filter((unit) => (
    normalize(unit.status) === "inservice"
  )).length;
  const outOfService = suite.apparatus.filter((unit) => (
    normalize(unit.status).includes("outofservice")
    || normalize(unit.status).includes("impaired")
  ));
  const inventoryEvents = useMemo(() => suite.events.filter((event) => {
    const eventType = normalize(event.event_type);
    return event.source === "inventory"
      || ["inventory", "apparatus", "equipment", "maintenance", "workorder", "stock"]
        .some((term) => eventType.includes(term));
  }), [suite.events]);
  const visibleApparatus = suite.apparatus.filter((unit) => {
    if (fleetFilter === "in-service") return normalize(unit.status) === "inservice";
    if (fleetFilter === "out-impaired") {
      return normalize(unit.status).includes("outofservice")
        || normalize(unit.status).includes("impaired");
    }
    if (fleetFilter === "digital-twins") return Boolean(matchingTwin(unit, twinData.apparatus));
    return true;
  });
  const fleetFilterLabel = fleetFilter === "in-service"
    ? "In-service apparatus"
    : fleetFilter === "out-impaired"
      ? "Out-of-service or impaired apparatus"
      : fleetFilter === "digital-twins"
        ? "Apparatus with digital twins"
        : "All apparatus";

  function openFleetFilter(filter: FleetFilter) {
    setFleetFilter(filter);
    setView("fleet");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function openUnit(unit: SuiteApparatus) {
    setSelectedApparatusId(unit.id);
    const twin = matchingTwin(unit, twinData.apparatus);
    if (twin && twinState === "ready") await loadTwin(twin.id);
    setView("check");
  }

  const activeDepartmentName = suite.department?.name || departmentName;

  return (
    <main className="inventory-app-shell">
      <header className="topbar">
        <Link className="portal-back" href="/" aria-label="Back to Firehouse Manager">
          <span aria-hidden="true">←</span>
          <b>Firehouse Manager</b>
        </Link>
        <button className="brand" onClick={() => setView("fleet")} aria-label="Inventory home">
          <span className="brand-badge">INV</span>
          <span>
            <b>Inventory</b>
            <small>READINESS - ASSETS - SERVICE</small>
          </span>
        </button>
        <span className="inventory-breadcrumb" aria-label="Current location">
          Station Duties <b>/ Inventory</b>
        </span>
        <nav className="desktop-nav" aria-label="Inventory sections">
          {([
            ["fleet", "Fleet"],
            ["check", "Apparatus"],
            ["readiness", "Readiness"],
            ["service", "Repairs"],
            ["stock", "Stock"],
          ] as [View, string][]).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="photo-setup" onClick={() => setView("setup")}>
            <Icon>+</Icon> Build Fleet &amp; Inventory
          </button>
          {inventoryEvents.length > 0 ? (
            <button
              className="alerts"
              onClick={() => setView("readiness")}
              aria-label={`${inventoryEvents.length} connected inventory updates`}
            >
              <Icon>!</Icon><span>{inventoryEvents.length}</span>
            </button>
          ) : null}
          <span className={`connection ${suiteState === "unavailable" ? "unavailable" : ""}`}>
            <i />
            {suiteState === "loading"
              ? "LOADING DEPARTMENT"
              : suiteState === "unavailable"
                ? "DEPARTMENT DATA UNAVAILABLE"
                : `${activeDepartmentName} - ${suite.apparatus.length} UNIT${suite.apparatus.length === 1 ? "" : "S"}`}
          </span>
        </div>
      </header>

      {view === "fleet" ? (
        <section className="page fleet-page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">VERIFIED DEPARTMENT RECORDS</span>
              <h1>Real apparatus and equipment records for your department.</h1>
              <p>
                This view shows only the active department&apos;s saved apparatus.
                Readiness, maintenance, stock, compartments, and photographs appear
                only when real records have been entered.
              </p>
            </div>
            <div className="heading-actions">
              <button className="primary" onClick={() => setView("setup")}>
                Build Fleet &amp; Inventory
              </button>
            </div>
          </div>

          <div className="source-truth-banner">
            <b>Source of truth</b>
            <span>Apparatus identity: Department inventory</span>
            <span>
              Inventory storage: {twinState === "ready"
                ? "Connected"
                : twinState === "loading"
                  ? "Checking"
                  : "Unavailable"}
            </span>
          </div>

          <div className="metrics inventory-metrics">
            <button type="button" onClick={() => openFleetFilter("all")}>
              <span>Apparatus records</span>
              <strong>{suite.apparatus.length}</strong>
              <small>Saved for this department</small>
            </button>
            <button type="button" onClick={() => openFleetFilter("in-service")}>
              <span>In service</span>
              <strong>{inService}</strong>
              <small>From saved department status</small>
            </button>
            <button type="button" onClick={() => openFleetFilter("out-impaired")}>
              <span>Out / impaired</span>
              <strong className={outOfService.length ? "danger-text" : ""}>
                {outOfService.length}
              </strong>
              <small>No inferred conditions</small>
            </button>
            <button type="button" onClick={() => openFleetFilter("digital-twins")}>
              <span>Digital twins linked</span>
              <strong>{twinState === "ready" ? linkedTwinCount : "-"}</strong>
              <small>Saved apparatus records only</small>
            </button>
            <button type="button" onClick={() => setView("readiness")}>
              <span>Inventory events</span>
              <strong>{inventoryEvents.length}</strong>
              <small>Connected event records</small>
            </button>
          </div>

          {suiteState === "ready" && suite.apparatus.length > 0 ? (
            <div className="fleet-filter-summary" role="status">
              <span>{fleetFilterLabel} · {visibleApparatus.length} shown</span>
              {fleetFilter !== "all" ? <button type="button" onClick={() => setFleetFilter("all")}>Clear filter</button> : null}
            </div>
          ) : null}

          {suiteState === "loading" ? (
            <OperationalState title="Loading department apparatus" kind="loading">
              Reading the verified department inventory.
            </OperationalState>
          ) : null}
          {suiteState === "unavailable" ? (
            <OperationalState
              title="Department apparatus is unavailable"
              kind="unavailable"
              action={<button className="secondary" onClick={() => window.location.reload()}>Try again</button>}
            >
              {suite.error || "The connected apparatus roster could not be loaded. No substitute units are displayed."}
            </OperationalState>
          ) : null}
          {suiteState === "ready" && suite.apparatus.length === 0 ? (
            <OperationalState
              title="No apparatus has been added"
              action={<button className="primary" onClick={() => setView("setup")}>Add apparatus</button>}
            >
              Add the department&apos;s first unit. Apparatus appears only after
              an authorized member saves the record.
            </OperationalState>
          ) : null}

          {suiteState === "ready" && suite.apparatus.length > 0 ? (
            <div className="fleet-grid">
              {visibleApparatus.map((unit) => {
                const twin = matchingTwin(unit, twinData.apparatus);
                return (
                  <article className="fleet-card" key={unit.id}>
                    <div className="fleet-visual real-source">
                      <span className="card-label">DEPARTMENT APPARATUS</span>
                      <div className="fleet-source-panel">
                        <span>{unit.call_sign || unit.unit_type || "UNIT"}</span>
                        <b>{unit.unit_name || "Unnamed apparatus"}</b>
                        <small>
                          {twinState === "unavailable"
                            ? "Inventory storage unavailable"
                            : twin
                              ? "Digital twin record linked"
                              : "No digital twin record yet"}
                        </small>
                      </div>
                    </div>
                    <div className="fleet-card-body">
                      <div className="card-top">
                        <div>
                          <span>{unit.station || "Station not recorded"} - {unit.call_sign || unit.id}</span>
                          <h2>{unit.unit_name || "Unnamed apparatus"}</h2>
                          <p>{unit.unit_type || "Unit type not recorded"}</p>
                        </div>
                        <StatePill tone={statusTone(unit.status)}>
                          {titleCase(unit.status)}
                        </StatePill>
                      </div>
                      <div className="fleet-card-meta real">
                        <span><b>{unit.station || "-"}</b>Station</span>
                        <span><b>{unit.cad_unit_id || "-"}</b>CAD unit ID</span>
                        <span><b>{twin ? "Ready" : "Setup needed"}</b>Inventory record</span>
                      </div>
                      {unit.notes ? <p className="unit-notes">{unit.notes}</p> : null}
                      <button className="card-action" onClick={() => void openUnit(unit)}>
                        <span className="card-action-copy">
                          <strong>Open Unit Checks &amp; Inventory</strong>
                          <small>Daily · Weekly · Inventory · Air Pack</small>
                        </span>
                        <span className="card-action-arrow" aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                );
              })}
              <button className="add-unit-card" onClick={() => setView("setup")}>
                <Icon>+</Icon>
                <b>Build Fleet &amp; Inventory</b>
                <span>Compartments - real photographs - hotspots</span>
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "check" ? (
        <section className="page apparatus-page">
          <div className="page-heading compact">
            <div>
              <span className="eyebrow">APPARATUS AND EQUIPMENT CHECKS</span>
              <h1>Complete the real department check.</h1>
              <p>Add equipment once, then record every pass, missing item, damaged item, or not-applicable result.</p>
            </div>
            <div className="heading-actions">
              <button className="secondary" onClick={() => setView("fleet")}>Back to fleet</button>
              <button className="primary" onClick={() => setView("setup")}>Build Fleet &amp; Inventory</button>
            </div>
          </div>
          <InventoryOperations view="check" onSetup={() => setView("setup")} initialApparatusId={selectedApparatusId} initialCheckType={initialCheckType} />
        </section>
      ) : null}

      {view === "readiness" ? (
        <section className="page">
          <div className="page-heading compact">
            <div>
              <span className="eyebrow">READINESS EXCEPTIONS</span>
              <h1>Missing and damaged equipment that needs action.</h1>
              <p>Exceptions are created only from saved department apparatus checks.</p>
            </div>
          </div>
          <div className="truth-columns">
            <section className="truth-panel">
              <span className="eyebrow">OUT OF SERVICE / IMPAIRED</span>
              <h2>{outOfService.length} apparatus record{outOfService.length === 1 ? "" : "s"}</h2>
              {outOfService.length ? (
                <div className="truth-list">
                  {outOfService.map((unit) => (
                    <article key={unit.id}>
                      <div>
                        <b>{unit.unit_name || unit.call_sign || "Unnamed apparatus"}</b>
                        <p>{unit.station || "Station not recorded"} - {unit.notes || "No status note"}</p>
                      </div>
                      <StatePill tone="danger">{titleCase(unit.status)}</StatePill>
                    </article>
                  ))}
                </div>
              ) : (
                <p>
                  No connected apparatus is marked out of service or impaired.
                  This does not assert that a shift check was completed.
                </p>
              )}
            </section>
            <section className="truth-panel">
              <span className="eyebrow">CONNECTED INVENTORY EVENTS</span>
              <h2>{inventoryEvents.length} recent update{inventoryEvents.length === 1 ? "" : "s"}</h2>
              {inventoryEvents.length ? (
                <div className="truth-list">
                  {inventoryEvents.map((event) => (
                    <article key={event.id}>
                      <div>
                        <b>{titleCase(event.event_type, "Inventory update")}</b>
                        <p>{event.record_id || "Record ID unavailable"} - {formatDate(event.occurred_at || event.created_at)}</p>
                      </div>
                      <StatePill tone={statusTone(event.status)}>{titleCase(event.status)}</StatePill>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No inventory-targeted integration events are available.</p>
              )}
            </section>
          </div>
          <InventoryOperations view="readiness" onSetup={() => setView("setup")} />
        </section>
      ) : null}

      {view === "service" ? (
        <section className="page">
          <div className="page-heading compact">
            <div>
              <span className="eyebrow">ASSIGNED REPAIRS</span>
              <h1>Assign, document, and close fleet repairs.</h1>
              <p>Repair notices appear on assigned employee home pages and Live Ops until the repair is completed.</p>
            </div>
          </div>
          <InventoryOperations view="service" onSetup={() => setView("setup")} />
        </section>
      ) : null}

      {view === "stock" ? (
        <section className="page">
          <div className="page-heading compact">
            <div>
              <span className="eyebrow">SUPPLY AND CONSUMABLES</span>
              <h1>Track real station supplies and current quantities.</h1>
              <p>Add supplies, record the starting count, and capture every use or receipt.</p>
            </div>
          </div>
          <InventoryOperations view="stock" onSetup={() => setView("setup")} />
        </section>
      ) : null}

      {view === "setup" ? (
        <section className="setup-page">
          <div className="setup-intro">
            <button onClick={() => setView("fleet")}>Back to fleet</button>
            <span className="eyebrow">BUILD FLEET &amp; INVENTORY · DIGITAL TWIN BUILDER</span>
            <h1>Add apparatus, compartments, photographs, and inspection inventory.</h1>
            <p>
              Inventory preserves real apparatus identities, photographs,
              compartments, equipment, and hotspot geometry.
            </p>
            <div className="capture-answer">
              <span>SOURCE CONTROL</span>
              <strong>{suite.apparatus.length} department unit{suite.apparatus.length === 1 ? "" : "s"}</strong>
              <p>The roster starts empty and shows only saved department apparatus.</p>
              <strong>{twinState === "ready" ? `${twinData.apparatus.length} Inventory record${twinData.apparatus.length === 1 ? "" : "s"}` : "Inventory storage unavailable"}</strong>
              <p>Supabase stores department-scoped digital-twin records and private original media.</p>
            </div>
          </div>
          <div className="capture-workspace">
            {twinState === "loading" ? (
              <OperationalState title="Checking Inventory storage" kind="loading">
                Verifying the department&apos;s digital-twin database and media bindings.
              </OperationalState>
            ) : twinState === "unavailable" ? (
              <OperationalState title="Digital-twin storage is unavailable" kind="unavailable">
                {twinData.error || "Inventory records and private photo storage are unavailable."}
                {" "}No changes can be saved until department storage is available.
              </OperationalState>
            ) : (
              <DigitalTwinBuilder
                data={twinData}
                suiteApparatus={suite.apparatus}
                onReload={loadTwin}
                onFleetReload={loadSuite}
                notify={showToast}
              />
            )}
            <InventoryOperations view="builder" onSetup={() => setView("setup")} initialApparatusId={selectedApparatusId} />
          </div>
        </section>
      ) : null}

      <nav className="mobile-nav" aria-label="Mobile inventory sections">
        {([
          ["fleet", "Fleet"],
          ["check", "Unit"],
          ["readiness", "Ready"],
          ["service", "Repairs"],
          ["stock", "Stock"],
        ] as [Exclude<View, "setup">, string][]).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <InventoryNavIcon view={id} />
            {label}
          </button>
        ))}
      </nav>
      {toast ? <div className="toast" role="status"><span>OK</span>{toast}</div> : null}
    </main>
  );
}

function DigitalTwinBuilder({
  data,
  suiteApparatus,
  onReload,
  onFleetReload,
  notify,
}: {
  data: TwinData;
  suiteApparatus: SuiteApparatus[];
  onReload: (apparatusId?: string) => Promise<void>;
  onFleetReload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [apparatusId, setApparatusId] = useState("");
  const [sourceUnitId, setSourceUnitId] = useState("");
  const [viewKey, setViewKey] = useState("driver");
  const [doorState, setDoorState] = useState("closed");
  const [viewLevel, setViewLevel] = useState("exterior");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [hotspotPhotoId, setHotspotPhotoId] = useState("");
  const [hotspotCompartmentId, setHotspotCompartmentId] = useState("");
  const [photoCompartmentId, setPhotoCompartmentId] = useState("");
  const [editingCompartmentId, setEditingCompartmentId] = useState("");
  const [pendingHotspot, setPendingHotspot] = useState<{
    xBasisPoints: number;
    yBasisPoints: number;
  } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const unlinkedUnits = suiteApparatus.filter((unit) => (
    !matchingTwin(unit, data.apparatus)
  ));
  const effectiveSourceUnitId = sourceUnitId || unlinkedUnits[0]?.id || "";
  const effectiveApparatusId = apparatusId || data.apparatus[0]?.id || "";
  const selectedApparatus = data.apparatus.find((item) => (
    item.id === effectiveApparatusId
  ));
  const photos = data.photos.filter((photo) => photo.apparatus_id === effectiveApparatusId);
  const compartments = data.compartments.filter((item) => item.apparatus_id === effectiveApparatusId);
  const effectiveHotspotCompartmentId = (
    compartments.some((item) => item.id === hotspotCompartmentId)
      ? hotspotCompartmentId
      : compartments[0]?.id || ""
  );
  const captured = requiredPhotoViews.filter(([key, state]) => (
    photos.some((photo) => photo.view_key === key && photo.door_state === state)
  )).length;
  const approvedPhotos = photos.filter((photo) => photo.approval_status === "approved");
  const selectedHotspotPhoto = approvedPhotos.find((photo) => photo.id === hotspotPhotoId);

  async function jsonAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/digital-twin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(text(result.error, 500) || "The change could not be saved.");
    }
    return result;
  }

  async function createApparatusFromSuite() {
    const source = suiteApparatus.find((unit) => unit.id === effectiveSourceUnitId);
    if (!source) {
      setError("Select a real department apparatus record.");
      return;
    }
    setBusy("apparatus");
    setError("");
    try {
      const result = await jsonAction({
        action: "create_apparatus",
        id: source.id,
        name: source.unit_name || source.call_sign,
        assetType: source.unit_type || "Not recorded",
      });
      const apparatus = record(result.apparatus);
      const id = text(apparatus?.id, 80) || source.id;
      setApparatusId(id);
      setSourceUnitId("");
      await onReload(id);
      notify("Apparatus added to the department Inventory.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apparatus could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function createStandaloneApparatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("apparatus");
    setError("");
    try {
      await jsonAction({
        action: "create_apparatus",
        name: form.get("name"),
        assetType: form.get("assetType"),
        vin: form.get("vin"),
        manufacturer: form.get("manufacturer"),
        model: form.get("model"),
        year: form.get("year"),
      });
      notify("Apparatus added to the department inventory.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apparatus could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function updateFleetStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveApparatusId) return;
    const form = new FormData(event.currentTarget);
    setBusy("fleet-status");
    setError("");
    try {
      await jsonAction({
        action: "update_apparatus_status",
        apparatusId: effectiveApparatusId,
        status: form.get("status"),
      });
      await Promise.all([
        onReload(effectiveApparatusId),
        onFleetReload(),
      ]);
      notify("Fleet status updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fleet status could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function updateWeeklyDueDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveApparatusId) return;
    const form = new FormData(event.currentTarget);
    setBusy("weekly-due-day");
    setError("");
    try {
      await jsonAction({
        action: "update_weekly_due_day",
        apparatusId: effectiveApparatusId,
        weeklyDueDay: form.get("weeklyDueDay"),
      });
      await onReload(effectiveApparatusId);
      notify("Weekly check due day updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Weekly check due day could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function createCompartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveApparatusId) {
      setError("Save the apparatus in Step 1 before adding a compartment.");
      window.document.getElementById("apparatus-name")?.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy("compartment");
    setError("");
    try {
      const result = await jsonAction({
        action: "create_compartment",
        apparatusId: effectiveApparatusId,
        label: form.get("label"),
        side: form.get("side"),
        sortOrder: compartments.length,
      });
      const compartment = record(result.compartment);
      const createdCompartmentId = text(compartment?.id, 80);
      if (createdCompartmentId) {
        setHotspotCompartmentId(createdCompartmentId);
      }
      await onReload(effectiveApparatusId);
      event.currentTarget.reset();
      notify("Compartment created with a stable ID.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Compartment could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function updateCompartment(event: FormEvent<HTMLFormElement>, compartmentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(`compartment-${compartmentId}`);
    setError("");
    try {
      await jsonAction({
        action: "update_compartment",
        apparatusId: effectiveApparatusId,
        compartmentId,
        label: form.get("label"),
        side: form.get("side"),
        sortOrder: form.get("sortOrder"),
      });
      await onReload(effectiveApparatusId);
      setEditingCompartmentId("");
      notify("Compartment updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Compartment could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function deleteCompartment(compartment: TwinCompartment) {
    if (!window.confirm(`Delete ${compartment.label}? Its hotspot markers will be removed. Saved photos will remain in the apparatus photo library.`)) return;
    setBusy(`compartment-${compartment.id}`);
    setError("");
    try {
      await jsonAction({ action: "delete_compartment", apparatusId: effectiveApparatusId, compartmentId: compartment.id });
      if (photoCompartmentId === compartment.id) setPhotoCompartmentId("");
      if (hotspotCompartmentId === compartment.id) setHotspotCompartmentId("");
      await onReload(effectiveApparatusId);
      notify("Compartment deleted. Saved photos were kept in the apparatus photo library.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Compartment could not be deleted.");
    } finally {
      setBusy("");
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoFile || !effectiveApparatusId) {
      setError("Choose an apparatus and a real photograph.");
      return;
    }
    const payload = new FormData();
    payload.set("photo", photoFile);
    payload.set("apparatusId", effectiveApparatusId);
    payload.set("viewKey", viewKey);
    payload.set("doorState", doorState);
    payload.set("viewLevel", viewLevel);
    if (photoCompartmentId) payload.set("compartmentId", photoCompartmentId);
    setBusy("photo");
    setError("");
    try {
      const response = await fetch("/api/digital-twin", {
        method: "POST",
        body: payload,
      });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(text(result.error, 500) || "Photo upload failed.");
      }
      await onReload(effectiveApparatusId);
      setPhotoFile(null);
      notify("Original photo preserved. Review it before operational use.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo upload failed.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  function closeCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }

  async function openCamera(nextViewKey?: string, nextDoorState?: string, nextCompartmentId?: string) {
    if (!effectiveApparatusId) {
      setError("Save the apparatus in Step 1 before taking photographs.");
      window.document.getElementById("apparatus-name")?.focus();
      return;
    }
    if (nextViewKey) setViewKey(nextViewKey);
    if (nextDoorState) setDoorState(nextDoorState);
    if (nextCompartmentId !== undefined) setPhotoCompartmentId(nextCompartmentId);
    setError("");
    setPhotoFile(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live camera is not supported in this browser. Use Choose existing photo instead.");
      return;
    }
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setCameraOpen(false);
      setError("Camera access was not allowed. Enable camera permission or use Choose existing photo.");
    }
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Wait for the preview, then try again.");
      return;
    }
    const canvas = window.document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("The camera image could not be captured.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => (
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    ));
    if (!blob) {
      setError("The camera image could not be captured.");
      return;
    }
    setPhotoFile(new File(
      [blob],
      `${viewKey}-${doorState}-${Date.now()}.jpg`,
      { type: "image/jpeg" },
    ));
    closeCamera();
    notify("Photo captured. Press Save photo for review.");
  }

  async function approvePhoto(photoId: string) {
    setBusy(photoId);
    setError("");
    try {
      await jsonAction({ action: "approve_photo", photoId });
      await onReload(effectiveApparatusId);
      notify("Photo approved for the apparatus walk-around.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo approval failed.");
    } finally {
      setBusy("");
    }
  }

  async function deletePhoto(photo: TwinPhoto) {
    if (!window.confirm(`Remove the ${photo.view_key} ${photo.door_state} photo from this apparatus?`)) return;
    setBusy(photo.id);
    setError("");
    try {
      await jsonAction({ action: "delete_photo", apparatusId: effectiveApparatusId, photoId: photo.id });
      if (hotspotPhotoId === photo.id) setHotspotPhotoId("");
      await onReload(effectiveApparatusId);
      notify("Photo removed from the active apparatus record.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo could not be removed.");
    } finally {
      setBusy("");
    }
  }

  function placeHotspot(event: React.MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xBasisPoints = Math.round(((event.clientX - bounds.left) / bounds.width) * 10000);
    const yBasisPoints = Math.round(((event.clientY - bounds.top) / bounds.height) * 10000);
    setPendingHotspot({ xBasisPoints, yBasisPoints });
  }

  async function saveHotspot() {
    if (!selectedHotspotPhoto || !effectiveHotspotCompartmentId || !pendingHotspot) {
      setError("Select an approved photo and compartment, then tap the photo before saving.");
      return;
    }
    const compartment = compartments.find((item) => item.id === effectiveHotspotCompartmentId);
    setBusy("hotspot");
    setError("");
    try {
      await jsonAction({
        action: "create_hotspot",
        photoViewId: selectedHotspotPhoto.id,
        compartmentId: effectiveHotspotCompartmentId,
        label: compartment?.label || "Compartment",
        xBasisPoints: pendingHotspot.xBasisPoints,
        yBasisPoints: pendingHotspot.yBasisPoints,
      });
      await onReload(effectiveApparatusId);
      setPendingHotspot(null);
      notify("Hotspot connected to the saved compartment.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hotspot could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="builder-live">
      <div className="capture-head">
        <div>
          <span>REAL APPARATUS CONFIGURATION</span>
          <h2>
            {effectiveApparatusId
              ? `${captured} of ${requiredPhotoViews.length} guided views captured`
              : "Add the first department apparatus"}
          </h2>
        </div>
        <div className="builder-status-pills">
          {selectedApparatus ? (
            <StatePill tone={statusTone(selectedApparatus.status)}>
              Fleet: {titleCase(selectedApparatus.status)}
            </StatePill>
          ) : null}
          <StatePill tone="success">DURABLE STORAGE READY</StatePill>
        </div>
      </div>
      {error ? (
        <div className="builder-error" role="alert">
          {error}<button onClick={() => setError("")}>Dismiss</button>
        </div>
      ) : null}

      <section className="builder-section">
        <div>
          <span className="eyebrow">1 - APPARATUS IDENTITY</span>
          <h3>Add and manage department apparatus</h3>
          <p>Only real department apparatus entered here will be displayed. Operational status always comes from Fleet.</p>
        </div>
        {data.apparatus.length > 0 ? (
          <label>
            Working apparatus
            <select
              value={effectiveApparatusId}
              onChange={(event) => {
                setApparatusId(event.target.value);
                setHotspotCompartmentId("");
                setHotspotPhotoId("");
                setPendingHotspot(null);
                void onReload(event.target.value);
              }}
            >
              {data.apparatus.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} - {titleCase(unit.status)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selectedApparatus ? (
          <div className="builder-fleet-settings">
          <form className="builder-form fleet-status-form" onSubmit={updateFleetStatus}>
            <label>
              Fleet status
              <select
                key={`${selectedApparatus.id}-${selectedApparatus.status}`}
                name="status"
                defaultValue={selectedApparatus.status}
              >
                <option value="in_service">In Service</option>
                <option value="out_of_service">Out of Service</option>
                <option value="impaired">Impaired</option>
              </select>
            </label>
            <button className="primary" disabled={busy === "fleet-status"}>
              {busy === "fleet-status" ? "Saving..." : "Save Fleet status"}
            </button>
          </form>
          <form className="builder-form fleet-status-form" onSubmit={updateWeeklyDueDay}>
            <label>
              Weekly check due day
              <select
                key={`${selectedApparatus.id}-${selectedApparatus.weekly_due_day ?? "none"}`}
                name="weeklyDueDay"
                defaultValue={selectedApparatus.weekly_due_day ?? ""}
              >
                <option value="">No weekly check scheduled</option>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
              <small>The weekly check appears in Duties and Live Operations on this day.</small>
            </label>
            <button className="primary" disabled={busy === "weekly-due-day"}>
              {busy === "weekly-due-day" ? "Saving..." : "Save weekly due day"}
            </button>
          </form>
          </div>
        ) : null}
        {unlinkedUnits.length ? (
          <div className="builder-form identity-source-form">
            <label>
              Connected department apparatus
              <select
                value={effectiveSourceUnitId}
                onChange={(event) => setSourceUnitId(event.target.value)}
              >
                {unlinkedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name || unit.call_sign || "Unnamed apparatus"}
                    {unit.call_sign ? ` - ${unit.call_sign}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              type="button"
              onClick={() => void createApparatusFromSuite()}
              disabled={busy === "apparatus"}
            >
              {busy === "apparatus" ? "Saving..." : "Save apparatus to Inventory"}
            </button>
          </div>
        ) : suiteApparatus.length === 0 ? (
          <form className="builder-form apparatus-create-form" onSubmit={createStandaloneApparatus}>
            <label>Unit name<input id="apparatus-name" name="name" required placeholder="Example: Engine 1" /></label>
            <label>Apparatus type<input name="assetType" required placeholder="Engine, ambulance, truck..." /></label>
            <label>VIN<input name="vin" autoComplete="off" /></label>
            <label>Manufacturer<input name="manufacturer" /></label>
            <label>Model<input name="model" /></label>
            <label>Year<input name="year" type="number" min="1900" max="2100" /></label>
            <button className="primary" disabled={busy === "apparatus"}>
              {busy === "apparatus" ? "Saving..." : "Save apparatus"}
            </button>
          </form>
        ) : (
          <p>Every department apparatus has an Inventory record.</p>
        )}
      </section>

      <section className="builder-section">
        <div>
          <span className="eyebrow">2 - COMPARTMENTS</span>
          <h3>Create stable storage locations</h3>
          {!effectiveApparatusId ? (
            <p className="builder-prerequisite" role="status">
              Save the apparatus in Step 1 first. Every compartment must be attached to a saved unit.
            </p>
          ) : null}
        </div>
        <form className="builder-form" onSubmit={createCompartment}>
          <label>Compartment ID / label<input name="label" required placeholder="Compartment label" /></label>
          <label>
            Side
            <select name="side">
              <option>driver</option>
              <option>officer</option>
              <option>rear</option>
              <option>cab</option>
              <option>pump</option>
              <option>interior</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={busy === "compartment"}
            onClick={(event) => {
              if (effectiveApparatusId) return;
              event.preventDefault();
              setError("Save the apparatus in Step 1 before adding a compartment.");
              window.document.getElementById("apparatus-name")?.focus();
            }}
          >
            {busy === "compartment"
              ? "Saving..."
              : effectiveApparatusId
                ? "Save compartment"
                : "Save apparatus first"}
          </button>
        </form>
        <div className="compartment-manager" aria-label="Saved compartments">
          {compartments.length ? compartments.map((item) => {
            const compartmentPhotos = photos.filter((photo) => photo.compartment_id === item.id);
            const closedPhoto = compartmentPhotos.find((photo) => photo.door_state === "closed");
            const openPhoto = compartmentPhotos.find((photo) => photo.door_state === "open");
            const editing = editingCompartmentId === item.id;
            return <article key={item.id}>
              {editing ? <form onSubmit={(event) => void updateCompartment(event, item.id)}>
                <label>Label<input name="label" defaultValue={item.label} required /></label>
                <label>Side<select name="side" defaultValue={item.side}>{["driver","officer","rear","cab","pump","interior"].map((side) => <option key={side}>{side}</option>)}</select></label>
                <label>Order<input name="sortOrder" type="number" min="0" defaultValue={item.sort_order} /></label>
                <div><button className="primary" disabled={busy === `compartment-${item.id}`}>{busy === `compartment-${item.id}` ? "Saving..." : "Save changes"}</button><button type="button" className="secondary" onClick={() => setEditingCompartmentId("")}>Cancel</button></div>
              </form> : <>
                <header><div><strong>{item.label}</strong><span>{titleCase(item.side)} · {[closedPhoto,openPhoto].filter(Boolean).length} of 2 required photos</span></div><b className={closedPhoto && openPhoto ? "complete" : "incomplete"}>{closedPhoto && openPhoto ? "PHOTO SET COMPLETE" : "PHOTOS NEEDED"}</b></header>
                <div className="compartment-photo-pair">
                  {([{"state":"closed","label":"Closed","photo":closedPhoto},{"state":"open","label":"Open","photo":openPhoto}] as const).map((slot) => <div className={slot.photo ? "saved" : "required"} key={slot.state}>
                    {slot.photo ? <Image src={slot.photo.url} alt={`${item.label} ${slot.label.toLowerCase()}`} width={240} height={150} unoptimized /> : <span>PHOTO REQUIRED</span>}
                    <strong>{slot.label} compartment</strong>
                    <button type="button" onClick={() => void openCamera("interior", slot.state, item.id)}>{slot.photo ? `Replace ${slot.label.toLowerCase()} photo` : `Take ${slot.label.toLowerCase()} photo`}</button>
                  </div>)}
                </div>
                <div className="compartment-actions"><button type="button" onClick={() => setEditingCompartmentId(item.id)}>Edit compartment</button><button type="button" className="danger" onClick={() => void deleteCompartment(item)} disabled={busy === `compartment-${item.id}`}>Delete compartment</button></div>
              </>}
            </article>;
          }) : <em>No compartments configured.</em>}
        </div>
      </section>

      <section className="builder-section">
        <div>
          <span className="eyebrow">3 - PHOTO CAPTURE</span>
          <h3>Capture matching closed and open views</h3>
          <p>On a phone or iPad, this opens the rear camera. Originals are preserved; replacements create a new version.</p>
        </div>
        <div className="required-photo-grid">
          {requiredPhotoViews.map(([key, state, label]) => {
            const photo = photos.find((item) => (
              item.view_key === key && item.door_state === state
            ));
            return (
              <button
                type="button"
                key={`${key}-${state}`}
                className={photo ? "captured" : ""}
                onClick={() => void openCamera(key, state)}
                aria-label={`Take ${label} photo with rear camera`}
              >
                <b>{photo ? "SAVED" : "PHOTO REQUIRED"}</b>
                <span>{label}</span>
                <small>{photo ? `v${photo.version_number} - ${photo.approval_status} - tap to replace` : "Tap to open camera"}</small>
              </button>
            );
          })}
        </div>
        <form className="builder-form photo-upload-form" onSubmit={uploadPhoto}>
          <label>
            View
            <select value={viewKey} onChange={(event) => setViewKey(event.target.value)}>
              {["driver", "officer", "front", "rear", "cab", "pump", "roof", "interior", "spin"]
                .map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Door state
            <select value={doorState} onChange={(event) => setDoorState(event.target.value)}>
              <option value="closed">closed</option>
              <option value="open">open</option>
              <option value="not_applicable">not applicable</option>
            </select>
          </label>
          <label>
            Level
            <select value={viewLevel} onChange={(event) => setViewLevel(event.target.value)}>
              <option value="exterior">exterior</option>
              <option value="interior">interior / compartment</option>
              <option value="container">bag / kit</option>
              <option value="spin">full rotation frame</option>
            </select>
          </label>
          <label>
            Compartment
            <select value={photoCompartmentId} onChange={(event) => setPhotoCompartmentId(event.target.value)}>
              <option value="">Whole apparatus / exterior</option>
              {compartments.map((item) => <option key={item.id} value={item.id}>{item.label} - {item.side}</option>)}
            </select>
          </label>
          <label className="file-field">
            Choose existing apparatus photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Choose existing apparatus photo"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
            <small>
              {photoFile
                ? `${photoFile.name} ready to upload.`
                : "Use this only when selecting a photo already saved on the device."}
            </small>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!effectiveApparatusId}
            onClick={() => void openCamera()}
          >
            Open rear camera
          </button>
          <button
            className="primary"
            disabled={!effectiveApparatusId || !photoFile || busy === "photo"}
          >
            {busy === "photo" ? "Saving original..." : "Save photo for review"}
          </button>
        </form>
        <div className="photo-review-grid">
          {photos.map((photo) => (
            <article key={photo.id}>
              <Image
                src={photo.url}
                alt={`${photo.view_key} ${photo.door_state}`}
                width={640}
                height={420}
                unoptimized
              />
              <div>
                <b>{photo.view_key} - {photo.door_state}</b>
                <small>{photo.compartment_id ? compartments.find((item) => item.id === photo.compartment_id)?.label || "Saved compartment" : "Whole apparatus"} · Version {photo.version_number} - {photo.approval_status}</small>
                <div className="photo-review-actions">
                {photo.approval_status !== "approved" ? (
                  <button
                    onClick={() => void approvePhoto(photo.id)}
                    disabled={busy === photo.id}
                  >
                    Approve photo
                  </button>
                ) : null}
                  <button type="button" onClick={() => void openCamera(photo.view_key, photo.door_state, photo.compartment_id || "")}>Replace photo</button>
                  <button type="button" className="danger" onClick={() => void deletePhoto(photo)} disabled={busy === photo.id}>Remove photo</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="builder-section">
        <div>
          <span className="eyebrow">4 - HOTSPOTS</span>
          <h3>Connect a photograph to a saved compartment</h3>
          <p>Select an approved photo and compartment, then tap the storage area.</p>
        </div>
        <div className="builder-form">
          <label>
            Approved photo
            <select
              value={hotspotPhotoId}
              onChange={(event) => {
                setHotspotPhotoId(event.target.value);
                setPendingHotspot(null);
              }}
            >
              <option value="">Select photo</option>
              {approvedPhotos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.view_key} - {photo.door_state} - v{photo.version_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Compartment
            <select
              value={effectiveHotspotCompartmentId}
              onChange={(event) => {
                setHotspotCompartmentId(event.target.value);
                setPendingHotspot(null);
              }}
              disabled={!compartments.length}
            >
              {!compartments.length ? <option value="">No saved compartments</option> : null}
              {compartments.map((item) => (
                <option key={item.id} value={item.id}>{item.label} - {item.side}</option>
              ))}
            </select>
            <span>{compartments.length} saved compartment{compartments.length === 1 ? "" : "s"} available</span>
          </label>
        </div>
        {selectedHotspotPhoto ? (
          <button
            className="hotspot-builder-image"
            onClick={placeHotspot}
            type="button"
            aria-label="Place compartment hotspot"
          >
            <Image
              src={selectedHotspotPhoto.url}
              alt="Selected apparatus view for hotspot placement"
              width={900}
              height={600}
              unoptimized
            />
            {data.hotspots
              .filter((item) => item.photo_view_id === selectedHotspotPhoto.id)
              .map((item) => (
                <i
                  key={item.id}
                  style={{
                    left: `${item.x_basis_points / 100}%`,
                    top: `${item.y_basis_points / 100}%`,
                  }}
                >
                  {item.label}
                </i>
              ))}
            {pendingHotspot ? (
              <i
                className="pending"
                style={{
                  left: `${pendingHotspot.xBasisPoints / 100}%`,
                  top: `${pendingHotspot.yBasisPoints / 100}%`,
                }}
              >
                NEW
              </i>
            ) : null}
          </button>
        ) : (
          <div className="builder-photo-required">
            <b>APPROVED PHOTO REQUIRED</b>
            <span>Take or choose a photo, upload it, then approve it before placing hotspots.</span>
            <button
              type="button"
              className="primary"
              onClick={() => void openCamera()}
            >
              Take photo for hotspots
            </button>
          </div>
        )}
        <button
          type="button"
          className="primary hotspot-save"
          disabled={
            busy === "hotspot"
            || !selectedHotspotPhoto
            || !effectiveHotspotCompartmentId
            || !pendingHotspot
          }
          onClick={() => void saveHotspot()}
        >
          {busy === "hotspot" ? "Saving hotspot..." : "Save hotspot"}
        </button>
      </section>
      {cameraOpen ? (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Rear camera">
          <div className="camera-panel">
            <header>
              <div>
                <span className="eyebrow">LIVE REAR CAMERA</span>
                <h3>{titleCase(viewKey)} · {titleCase(doorState)}</h3>
              </div>
              <button type="button" onClick={closeCamera}>Cancel</button>
            </header>
            {cameraStream ? (
              <video ref={cameraVideoRef} autoPlay playsInline muted />
            ) : (
              <div className="camera-starting" role="status">Starting camera…</div>
            )}
            <button
              type="button"
              className="primary camera-shutter"
              disabled={!cameraStream}
              onClick={() => void captureCameraPhoto()}
            >
              Capture photo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
