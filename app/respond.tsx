"use client";
/* eslint-disable @next/next/no-img-element -- preplan photos are protected runtime records. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRespondMilitaryTime, formatRespondTime } from "./respond-time";
import {
  hasConstructionProfile,
  hasOccupancyProfile,
  type ConstructionProfile,
  type OccupancyProfile,
} from "./preplans/profiles";

type Point = { lat: number; lng: number };
type Feature = {
  id: string;
  featureType: string;
  label: string;
  latitude: number;
  longitude: number;
  systemType: string;
  serviceStatus: string;
  details: string;
};
type Photo = {
  id: string;
  side: string;
  featureId?: string;
  caption: string;
  url: string;
};
type Preplan = {
  id: string;
  businessName: string;
  address: string;
  latitude: number;
  longitude: number;
  aSideLatitude?: number | null;
  aSideLongitude?: number | null;
  footprint: Point[];
  footprintSquareFeet: number;
  floorCount: number;
  constructionType: string;
  suggestedFireFlowGpm: number;
  suggestedFireFlowDuration: number;
  contactInfo: string;
  construction: string;
  accessInfo: string;
  alarmSystem: string;
  knoxBox: string;
  riser: string;
  fdc: string;
  sprinklerSystem: string;
  status: string;
  updatedAt: string;
  features: Feature[];
  photos: Photo[];
};
type ActiveCall = {
  reportNumber: string;
  callType: string;
  category: string;
  address: string;
  city: string;
  narrative: string;
  respondingUnits: string;
  longitude: number | null;
  latitude: number | null;
  dispatchedAt: string;
  timeOut: string;
  source: string;
  receivedAt: string;
};
type RecentCall = {
  reportNumber: string;
  callType: string;
  address: string;
  respondingUnits: string;
  timeOut: string;
  timeIn: string;
  logDate: string;
};
type BoxCard = {
  id: string;
  title: string;
  address: string;
  boxNumber: string;
  accessNotes: string;
  status: string;
};
type NearbyHydrant = {
  id: string;
  hydrantNumber: string;
  address: string;
  latitude: number;
  longitude: number;
  serviceStatus: string;
  distanceFeet: number;
};
type RespondData = {
  activeCall: ActiveCall | null;
  preplan: Preplan | null;
  match: { method: "address" | "gps"; distanceFeet: number } | null;
  cadUpdates: Array<{
    eventType: string;
    status: string;
    receivedAt: string;
    narrative: string;
    respondingUnits: string;
  }>;
  apparatusFilter: string | null;
  generatedAt: string;
  recentCalls: RecentCall[];
  boxCard: BoxCard | null;
  nearestHydrants: NearbyHydrant[];
  operational: null | {
    levels: Array<{
      id: string;
      name: string;
      shortLabel: string;
      isDefault: number;
    }>;
    spaces: Array<{ id: string; levelId: string; name: string }>;
    alerts: Array<{
      id: string;
      title: string;
      message: string;
      severity: string;
      levelId?: string;
      spaceId?: string;
      expiresAt?: string;
    }>;
    hazmat: Array<{
      id: string;
      materialName: string;
      unNumber: string;
      ergGuideNumber: string;
      quantity?: number;
      quantityUnit?: string;
      levelId?: string;
      spaceId?: string;
    }>;
    hoseLays: Array<{
      id: string;
      name: string;
      recommendedHoseFeet: number;
      hoseSizeInches: number;
      supplyLineLabel: string;
    }>;
    construction: ConstructionProfile;
    occupancy: OccupancyProfile;
    revision?: { revisionNumber: number; publishedAt: string };
    roomMatch?: {
      room: { id: string; name: string; levelId?: string } | null;
      confidence: number;
      reason: string;
    };
  };
};
type QuickItem = {
  id: string;
  label: string;
  summary: string;
  details: string;
  status?: string;
  latitude?: number;
  longitude?: number;
};
type RightView = "cad" | "footprint" | "B" | "C" | "D";

const featureLabels: Record<string, string> = {
  alarm: "Alarm",
  knox: "Knox Box",
  riser: "System Riser",
  fdc: "FDC",
  sprinkler: "Sprinkler",
  gas: "Gas Shutoff",
  water: "Water Shutoff",
  electric: "Electrical",
  propane: "Propane",
  elevator: "Elevator",
  elevator_room: "Elevator Room",
  standpipe: "Standpipe",
  access: "Access",
  hazard: "Hazard",
};
const featureSymbols: Record<string, string> = {
  alarm: "AL",
  knox: "K",
  riser: "R",
  fdc: "F",
  sprinkler: "SP",
  gas: "G",
  water: "W",
  electric: "E",
  propane: "P",
  elevator: "EV",
  elevator_room: "ER",
  standpipe: "ST",
  access: "A",
  hazard: "!",
};

const displayTime = formatRespondTime;
function sidePhoto(preplan: Preplan | null, side: string) {
  return (
    preplan?.photos.find((photo) => photo.side.trim().toUpperCase() === side) ??
    null
  );
}
function googleNavigation(call: ActiveCall) {
  const destination =
    call.latitude != null && call.longitude != null
      ? `${call.latitude},${call.longitude}`
      : [call.address, call.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
function streetViewLocation(call: ActiveCall) {
  return call.latitude != null && call.longitude != null
    ? `${call.latitude},${call.longitude}`
    : [call.address, call.city].filter(Boolean).join(", ");
}
function googleLocation(call: ActiveCall) {
  if (call.latitude != null && call.longitude != null) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${call.latitude},${call.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(streetViewLocation(call))}`;
}

function StreetViewFallback({ call }: { call: ActiveCall }) {
  const [unavailable, setUnavailable] = useState(false);
  const location = streetViewLocation(call);
  if (!location || unavailable)
    return (
      <div className="respond-empty overlay">
        <strong>Building photo unavailable</strong>
        <span>
          No approved Alpha photo or Street View image is available for this
          address.
        </span>
        {location && (
          <a
            href={googleLocation(call)}
            target="_blank"
            rel="noreferrer"
            data-test-safe
          >
            Open location in Google Maps ↗
          </a>
        )}
      </div>
    );
  return (
    <>
      <img
        src={`/api/respond/street-view?location=${encodeURIComponent(location)}`}
        alt={`Google Street View of ${location}`}
        onError={() => setUnavailable(true)}
      />
      <a
        className="respond-street-view-link"
        href={googleLocation(call)}
        target="_blank"
        rel="noreferrer"
        data-test-safe
      >
        Open Street View ↗
      </a>
    </>
  );
}

function FootprintDiagram({
  preplan,
  selectedId,
  onSelect,
}: {
  preplan: Preplan;
  selectedId: string;
  onSelect: (item: QuickItem) => void;
}) {
  const points = [
    ...preplan.footprint.map((point) => ({
      latitude: point.lat,
      longitude: point.lng,
    })),
    ...preplan.features,
  ];
  if (preplan.footprint.length < 3)
    return (
      <div className="respond-empty compact">
        <strong>Footprint not captured</strong>
        <span>Add the building corners in Field Preplans.</span>
      </div>
    );
  const latitudes = points.map((point) => Number(point.latitude)),
    longitudes = points.map((point) => Number(point.longitude));
  const minLat = Math.min(...latitudes),
    maxLat = Math.max(...latitudes),
    minLng = Math.min(...longitudes),
    maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.00001),
    lngRange = Math.max(maxLng - minLng, 0.00001);
  const project = (latitude: number, longitude: number) => ({
    x: 8 + ((longitude - minLng) / lngRange) * 84,
    y: 92 - ((latitude - minLat) / latRange) * 84,
  });
  const polygon = preplan.footprint
    .map((point) => {
      const p = project(point.lat, point.lng);
      return `${p.x},${p.y}`;
    })
    .join(" ");
  return (
    <div className="respond-footprint">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Building footprint and mapped fire protection features"
      >
        <path d="M92 14 L92 4 L88 9 Z" className="north-arrow" />
        <text x="92" y="3" textAnchor="middle">
          N
        </text>
        <polygon points={polygon} />
        {preplan.features.map((feature) => {
          const p = project(feature.latitude, feature.longitude);
          return (
            <g
              key={feature.id}
              className={selectedId === feature.id ? "selected" : ""}
              onClick={() =>
                onSelect({
                  id: feature.id,
                  label:
                    feature.label ||
                    featureLabels[feature.featureType] ||
                    feature.featureType,
                  summary:
                    feature.systemType ||
                    featureLabels[feature.featureType] ||
                    feature.featureType,
                  details: feature.details,
                  status: feature.serviceStatus,
                  latitude: feature.latitude,
                  longitude: feature.longitude,
                })
              }
            >
              <circle cx={p.x} cy={p.y} r="5" />
              <text x={p.x} y={p.y + 1.4} textAnchor="middle">
                {featureSymbols[feature.featureType] || "•"}
              </text>
            </g>
          );
        })}
      </svg>
      <small>Tap a symbol for its quick location and system details.</small>
    </div>
  );
}

export default function Respond({
  apparatus = "",
  onNavigate,
}: {
  apparatus?: string;
  onNavigate?: (page: "Daily Log" | "Field Preplans" | "Box Cards") => void;
}) {
  const [data, setData] = useState<RespondData | null>(null),
    [error, setError] = useState(""),
    [view, setView] = useState<RightView>("cad"),
    [selected, setSelected] = useState<QuickItem | null>(null);
  const [monitorMode, setMonitorMode] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const pageRef = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    try {
      const query = apparatus
        ? `?apparatus=${encodeURIComponent(apparatus)}`
        : "";
      const response = await fetch(`/api/respond${query}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as RespondData & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Unable to load Respond.");
      setData(body);
      setError("");
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load Respond.",
      );
    }
  }, [apparatus]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const update = () => {
      if (!document.fullscreenElement) setMonitorMode(false);
    };
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleMonitor() {
    if (monitorMode) {
      setMonitorMode(false);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
      return;
    }
    setMonitorMode(true);
    await pageRef.current?.requestFullscreen().catch(() => {});
  }
  const quickItems = useMemo<QuickItem[]>(() => {
    const plan = data?.preplan;
    if (!plan) return [];
    const staticItems = [
      ["knox", "Knox Box", plan.knoxBox],
      ["alarm", "Alarm System", plan.alarmSystem],
      ["riser", "System Riser", plan.riser],
      ["fdc", "FDC", plan.fdc],
      ["sprinkler", "Sprinkler System", plan.sprinklerSystem],
      ["access", "Access / Concerns", plan.accessInfo],
      ["construction", "Building Construction", plan.construction],
      ["contact", "Contact", plan.contactInfo],
    ]
      .filter((item) => item[2])
      .map(([id, label, value]) => ({
        id: `summary-${id}`,
        label,
        summary: value,
        details: value,
      }));
    const mapped = plan.features.map((feature) => ({
      id: feature.id,
      label:
        feature.label ||
        featureLabels[feature.featureType] ||
        feature.featureType,
      summary:
        feature.systemType ||
        featureLabels[feature.featureType] ||
        feature.featureType,
      details: feature.details,
      status: feature.serviceStatus,
      latitude: feature.latitude,
      longitude: feature.longitude,
    }));
    return [...mapped, ...staticItems];
  }, [data?.preplan]);
  const call = data?.activeCall ?? null,
    plan = data?.preplan ?? null,
    alpha = sidePhoto(plan, "A"),
    selectedSide =
      view === "B" || view === "C" || view === "D"
        ? sidePhoto(plan, view)
        : null,
    selectedFeaturePhoto = selected
      ? plan?.photos.find((photo) => photo.featureId === selected.id)
      : undefined;
  const selectedLevel =
      data?.operational?.levels.find((level) => level.id === selectedLevelId) ??
      data?.operational?.levels.find((level) => Boolean(level.isDefault)) ??
      data?.operational?.levels[0] ??
      null,
    visibleAlerts =
      data?.operational?.alerts.filter(
        (item) => !item.levelId || item.levelId === selectedLevel?.id,
      ) ?? [],
    visibleHazmat =
      data?.operational?.hazmat.filter(
        (item) => !item.levelId || item.levelId === selectedLevel?.id,
      ) ?? [];
  if (!data && !error)
    return (
      <section className="respond-page">
        <div className="respond-empty">
          <strong>Loading active response…</strong>
          <span>Checking current CAD and preplan records.</span>
        </div>
      </section>
    );
  if (error && !data)
    return (
      <section className="respond-page">
        <div className="respond-empty danger">
          <strong>Respond could not load</strong>
          <span>{error}</span>
          <button onClick={() => void load()}>Try again</button>
        </div>
      </section>
    );
  if (!call)
    return (
      <section
        ref={pageRef}
        className={`respond-page${monitorMode ? " monitor-view" : ""}`}
      >
        <header className="respond-title">
          <div>
            <span>FIELD · RESPOND</span>
            <h1>Response Workspace</h1>
            {apparatus && (
              <b className="respond-apparatus-badge">
                Apparatus Mode · Unit {apparatus}
              </b>
            )}
          </div>
          <div className="respond-title-actions">
            <small>Checks every 10 seconds</small>
            <button onClick={() => void toggleMonitor()}>
              {monitorMode ? "Exit Monitor" : "Monitor View"}
            </button>
          </div>
        </header>
        <div className="respond-idle-actions">
          <div>
            <strong>
              No active call{apparatus ? ` for Unit ${apparatus}` : ""}
            </strong>
            <span>
              {apparatus
                ? `A call appears when CAD lists Unit ${apparatus}.`
                : "Start an incident in the Daily Log or search preplans before a response."}
            </span>
          </div>
          <button onClick={() => onNavigate?.("Daily Log")}>
            Start incident
          </button>
          <button
            className="secondary"
            onClick={() => onNavigate?.("Field Preplans")}
          >
            Search preplans
          </button>
        </div>
        <section className="respond-recent">
          <header>
            <div>
              <span>RECENT ACTIVITY</span>
              <h2>Closed calls</h2>
            </div>
            <small>{data?.recentCalls?.length ?? 0} shown</small>
          </header>
          {data?.recentCalls?.length ? (
            <div>
              {data.recentCalls.map((recent) => (
                <article key={`${recent.reportNumber}-${recent.logDate}`}>
                  <time>{recent.logDate}</time>
                  <strong>{recent.callType || "Call type not entered"}</strong>
                  <span>{recent.address || "Address not entered"}</span>
                  <small>
                    {recent.respondingUnits || "Units not entered"} ·{" "}
                    {formatRespondMilitaryTime(recent.timeOut)}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="respond-empty compact">
              <strong>No recent closed calls</strong>
              <span>Completed Daily Log calls will appear here.</span>
            </div>
          )}
        </section>
      </section>
    );
  return (
    <section
      ref={pageRef}
      className={`respond-page${monitorMode ? " monitor-view" : ""}`}
    >
      {apparatus && (
        <div className="respond-apparatus-strip">
          <strong>APPARATUS RESPOND · UNIT {apparatus}</strong>
          <span>
            Only CAD incidents assigned to this unit are displayed on this
            device.
          </span>
        </div>
      )}
      <header className="respond-callbar">
        <div>
          <span>ACTIVE CALL · {call.source || "CAD"}</span>
          <h1>{call.callType || call.category || "Call type not reported"}</h1>
          <p>
            {[call.address, call.city].filter(Boolean).join(", ") ||
              "Address not reported"}
          </p>
        </div>
        <dl>
          <div>
            <dt>Call #</dt>
            <dd>{call.reportNumber || "Pending"}</dd>
          </div>
          <div>
            <dt>Time out</dt>
            <dd>
              {formatRespondMilitaryTime(call.timeOut || call.dispatchedAt)}
            </dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>{call.respondingUnits || "Not reported"}</dd>
          </div>
        </dl>
        <div className="respond-call-actions">
          <button
            className="respond-monitor"
            onClick={() => void toggleMonitor()}
            data-test-safe
          >
            {monitorMode ? "Exit Monitor" : "Monitor View"}
          </button>
          <a
            className="respond-nav"
            href={googleNavigation(call)}
            target="_blank"
            rel="noreferrer"
            data-test-safe
          >
            Open Google Navigation ↗
          </a>
        </div>
      </header>
      <div className="respond-statusline">
        <span className={plan ? "matched" : "unmatched"}>
          {plan
            ? `Preplan matched by ${data?.match?.method}${data?.match?.method === "gps" ? ` · ${data.match.distanceFeet} ft` : ""}`
            : "No matching preplan"}
        </span>
        <span>Updated {displayTime(data?.generatedAt || "")}</span>
        {error && <span className="warning">{error}</span>}
      </div>
      {data?.operational && (
        <>
          <nav className="respond-level-switcher" aria-label="Preplan level">
            <strong>LEVEL · {selectedLevel?.name || "Arrival / Ground"}</strong>
            <div>
              {data.operational.levels.map((level) => (
                <button
                  key={level.id}
                  className={selectedLevel?.id === level.id ? "active" : ""}
                  aria-pressed={selectedLevel?.id === level.id}
                  onClick={() => {
                    setSelectedLevelId(level.id);
                    setSelected(null);
                  }}
                >
                  {level.shortLabel || level.name}
                </button>
              ))}
            </div>
          </nav>
          <section
            className="respond-operational-banner"
            aria-label="Published operational preplan intelligence"
          >
            <header>
              <span>
                PREPLAN 2.0 · REV{" "}
                {data.operational.revision?.revisionNumber ?? "LEGACY"} ·{" "}
                {selectedLevel?.name || "Arrival / Ground"}
              </span>
              <strong>
                {data.operational.roomMatch?.room
                  ? `CAD room match: ${data.operational.roomMatch.room.name}`
                  : "No reliable CAD room match"}
              </strong>
            </header>
            <div>
              {visibleAlerts.slice(0, 3).map((alert) => (
                <article key={alert.id} className={alert.severity}>
                  <b>{alert.severity.toUpperCase()}</b>
                  <strong>{alert.title}</strong>
                  <span>{alert.message}</span>
                </article>
              ))}
              {visibleHazmat.slice(0, 3).map((item) => (
                <article key={item.id} className="hazmat">
                  <b>HAZMAT</b>
                  <strong>{item.materialName}</strong>
                  <span>
                    {item.unNumber
                      ? `UN/NA ${item.unNumber}`
                      : "UN/NA not entered"}{" "}
                    ·{" "}
                    {item.ergGuideNumber
                      ? `ERG ${item.ergGuideNumber}`
                      : "Verify in official ERG"}
                  </span>
                </article>
              ))}
              {hasConstructionProfile(data.operational.construction) && (
                <article
                  className={
                    data.operational.construction.bowstringTruss === "yes" ||
                    data.operational.construction.lightweightConstruction ===
                      "yes"
                      ? "critical"
                      : "construction"
                  }
                >
                  <b>VERIFIED CONSTRUCTION</b>
                  <strong>
                    {data.operational.construction.bowstringTruss === "yes"
                      ? "Bowstring truss"
                      : data.operational.construction.constructionType ||
                        data.operational.construction.roofType ||
                        "Construction profile"}
                  </strong>
                  <span>
                    {[
                      data.operational.construction.roofSupportSystem,
                      data.operational.construction.lightweightConstruction ===
                      "yes"
                        ? "Lightweight construction"
                        : data.operational.construction.basementType,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </article>
              )}
              {hasOccupancyProfile(data.operational.occupancy) && (
                <article className="occupancy">
                  <b>VERIFIED OCCUPANCY</b>
                  <strong>
                    {data.operational.occupancy.classification ||
                      "Occupancy profile"}
                  </strong>
                  <span>
                    {[
                      data.operational.occupancy.sleepingOccupants === "yes"
                        ? "Sleeping occupants"
                        : null,
                      data.operational.occupancy.nonAmbulatory === "yes"
                        ? "Non-ambulatory occupants"
                        : null,
                      data.operational.occupancy.assistanceNeeded === "yes"
                        ? "Assistance needed"
                        : null,
                      data.operational.occupancy.peakOccupancy != null
                        ? `Peak ${data.operational.occupancy.peakOccupancy}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Verified profile available"}
                  </span>
                </article>
              )}
            </div>
          </section>
        </>
      )}
      <section className="respond-glance" aria-label="Matched response records">
        <article>
          <span>BOX CARD</span>
          <strong>{data?.boxCard?.title || "No matching box card"}</strong>
          <small>
            {data?.boxCard
              ? `${data.boxCard.boxNumber || "Number pending"} · ${data.boxCard.accessNotes || data.boxCard.address}`
              : "Search by the incident address."}
          </small>
          <button onClick={() => onNavigate?.("Box Cards")}>
            Open box cards
          </button>
        </article>
        <article>
          <span>NEAREST HYDRANTS</span>
          {data?.nearestHydrants?.length ? (
            <div>
              {data.nearestHydrants.map((hydrant) => (
                <p key={hydrant.id}>
                  <b>
                    {hydrant.hydrantNumber ||
                      hydrant.address ||
                      "Mapped hydrant"}
                  </b>
                  <small>
                    {hydrant.distanceFeet.toLocaleString()} ft ·{" "}
                    {hydrant.serviceStatus.replaceAll("_", " ")}
                  </small>
                </p>
              ))}
            </div>
          ) : (
            <small>No verified hydrants are mapped near this incident.</small>
          )}
          <button onClick={() => onNavigate?.("Field Preplans")}>
            Open preplans & hydrants
          </button>
        </article>
      </section>
      <div className="respond-grid">
        <aside className="respond-intel">
          <header>
            <span>BUILDING INTELLIGENCE</span>
            <h2>{plan?.businessName || "No preplan found"}</h2>
            <p>
              {plan?.address || "Use the active-call address while en route."}
            </p>
          </header>
          {plan && (
            <div className="respond-building-stats">
              <span>
                {Math.round(plan.footprintSquareFeet || 0).toLocaleString()} sq
                ft
              </span>
              <span>
                {plan.floorCount || 1} floor{plan.floorCount === 1 ? "" : "s"}
              </span>
              {plan.suggestedFireFlowGpm > 0 && (
                <span>
                  {Math.round(plan.suggestedFireFlowGpm).toLocaleString()} GPM
                  suggested
                </span>
              )}
            </div>
          )}
          <div className="respond-intel-list">
            {quickItems.map((item) => (
              <button
                key={item.id}
                className={selected?.id === item.id ? "selected" : ""}
                onClick={() => setSelected(item)}
                data-test-safe
              >
                <span className="feature-symbol">
                  {featureSymbols[item.id.replace("summary-", "")] ||
                    featureSymbols[
                      plan?.features.find((feature) => feature.id === item.id)
                        ?.featureType || ""
                    ] ||
                    "i"}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.summary || "Details available"}</small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
          {!quickItems.length && (
            <div className="respond-empty compact">
              <strong>No building systems entered</strong>
              <span>Add them in Field Preplans.</span>
            </div>
          )}
        </aside>
        <main className="respond-alpha">
          <header>
            <div>
              <span>PRIMARY VIEW</span>
              <h2>Alpha / A Side</h2>
            </div>
            {plan && <span className="record-badge">{plan.status}</span>}
          </header>
          <div className="respond-primary-media">
            {alpha ? (
              <img
                src={alpha.url}
                alt={
                  alpha.caption ||
                  `Alpha side of ${plan?.businessName || call.address}`
                }
              />
            ) : (
              <StreetViewFallback call={call} />
            )}
          </div>
          <footer>
            <strong>
              {alpha?.caption || plan?.businessName || call.address}
            </strong>
            <span>
              {alpha
                ? "Approved Alpha-side preplan photo"
                : "Google Street View fallback · Verify current conditions"}
            </span>
          </footer>
        </main>
        <aside className="respond-context">
          <nav>
            {(["cad", "footprint", "B", "C", "D"] as RightView[]).map(
              (item) => (
                <button
                  key={item}
                  className={view === item ? "active" : ""}
                  onClick={() => setView(item)}
                  data-test-safe
                >
                  {item === "cad"
                    ? "CAD Notes"
                    : item === "footprint"
                      ? "Footprint"
                      : `${item} Side`}
                </button>
              ),
            )}
          </nav>
          <div className="respond-context-body">
            {view === "cad" && (
              <>
                <header>
                  <span>LIVE CAD UPDATES</span>
                  <h2>Dispatch Notes</h2>
                </header>
                {data?.cadUpdates.length ? (
                  data.cadUpdates.map((update, index) => (
                    <article
                      className="cad-update"
                      key={`${update.receivedAt}-${index}`}
                    >
                      <div>
                        <strong>{update.eventType || "CAD update"}</strong>
                        <time>{displayTime(update.receivedAt)}</time>
                      </div>
                      {update.narrative && <p>{update.narrative}</p>}
                      {update.respondingUnits && (
                        <small>Units: {update.respondingUnits}</small>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="respond-empty compact">
                    <strong>No CAD narrative received</strong>
                    <span>
                      The incident header will still refresh automatically.
                    </span>
                  </div>
                )}
              </>
            )}
            {view === "footprint" &&
              (plan ? (
                <>
                  <header>
                    <span>TACTICAL MAP</span>
                    <h2>Footprint + Systems</h2>
                  </header>
                  <FootprintDiagram
                    preplan={plan}
                    selectedId={selected?.id || ""}
                    onSelect={setSelected}
                  />
                </>
              ) : (
                <div className="respond-empty compact">
                  <strong>No footprint available</strong>
                  <span>No preplan matched this active call.</span>
                </div>
              ))}
            {(view === "B" || view === "C" || view === "D") &&
              (selectedSide ? (
                <div className="respond-side-photo">
                  <img
                    src={selectedSide.url}
                    alt={selectedSide.caption || `${view} side`}
                  />
                  <strong>{selectedSide.caption || `${view} Side`}</strong>
                </div>
              ) : (
                <div className="respond-empty compact">
                  <strong>{view} Side photo required</strong>
                  <span>Add the exterior photo in Field Preplans.</span>
                </div>
              ))}
          </div>
        </aside>
      </div>
      <section
        className={`respond-quick ${selected ? "open" : ""}`}
        aria-live="polite"
      >
        {selected ? (
          <>
            <div>
              {selectedFeaturePhoto && (
                <img
                  className="respond-feature-photo"
                  src={selectedFeaturePhoto.url}
                  alt={
                    selectedFeaturePhoto.caption || `${selected.label} feature`
                  }
                />
              )}
              <span>QUICK INFORMATION</span>
              <h2>{selected.label}</h2>
            </div>
            <dl>
              <div>
                <dt>Type / system</dt>
                <dd>{selected.summary || "Not entered"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {selected.status?.replaceAll("_", " ") || "Not reported"}
                </dd>
              </div>
              <div>
                <dt>Details</dt>
                <dd>{selected.details || "No additional details entered."}</dd>
              </div>
              {selected.latitude != null && selected.longitude != null && (
                <div>
                  <dt>GPS location</dt>
                  <dd>
                    {selected.latitude.toFixed(6)},{" "}
                    {selected.longitude.toFixed(6)} ·{" "}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open map ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close quick information"
              data-test-safe
            >
              ×
            </button>
          </>
        ) : (
          <>
            <strong>Select building information or a footprint symbol</strong>
            <span>
              Quick location, status, photo, and system details will appear
              here.
            </span>
          </>
        )}
      </section>
    </section>
  );
}
