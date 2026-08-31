"use client";
/* eslint-disable @next/next/no-img-element -- preplan photos are protected runtime records. */

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatRespondMilitaryTime, formatRespondTime } from "./respond-time";
import {
  cacheRespondPacket,
  clearCachedRespondPackets,
  getCachedRespondPacket,
  removeCachedRespondPacket,
} from "./preplans/offline-cache";
import {
  hasConstructionProfile,
  hasOccupancyProfile,
  type ConstructionProfile,
  type OccupancyProfile,
} from "./preplans/profiles";
import {
  readRespondProgress,
  respondProgressSteps,
  type RespondProgress,
  type RespondProgressStatus,
  writeRespondProgress,
} from "./respond-progress";
import RespondOverviewMap, {
  respondApparatusStatusLabel,
  type RespondOverview,
} from "./respond-overview-map";

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
  primaryLevelId?: string;
  verifiedAt?: string;
  updatedAt?: string;
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
  targetHazardLevel?: string;
  targetHazardReasons?: string[];
  targetHazardFactorScore?: number;
  targetHazardOverride?: number;
  targetHazardScore?: number;
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
  departmentId: string;
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
  overview?: RespondOverview;
  operational: null | {
    levels: Array<{
      id: string;
      name: string;
      shortLabel: string;
      isDefault: number;
    }>;
    spaces: Array<{
      id: string;
      levelId: string;
      name: string;
      roomNumber?: string;
      aliases: string[];
      cadKeywords: string[];
      spaceType: string;
      geometry: unknown;
      coordinateSpace: string;
      accessNotes?: string;
      fireProtectionNotes?: string;
      hazards?: string;
    }>;
    alerts: Array<{
      id: string;
      title: string;
      message: string;
      severity: string;
      alertType?: string;
      levelId?: string;
      spaceId?: string;
      effectiveAt?: string;
      expiresAt?: string;
      expirationAction?: string;
      verifiedAt?: string;
      expiredUnverified?: boolean;
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
      storageType?: string;
      physicalState?: string;
      exactLocation?: string;
      nfpaHealth?: number;
      nfpaFlammability?: number;
      nfpaInstability?: number;
      nfpaSpecial?: string;
      dateVerified?: string;
      notes?: string;
    }>;
    hazmatZones: Array<{
      id: string;
      hazmatId: string;
      levelId?: string;
      zoneType: string;
      geometryType: string;
      geometry: unknown;
      label: string;
      radiusFeet?: number;
      fillColor?: string;
      lineColor?: string;
      opacity?: number;
    }>;
    hoseLays: Array<{
      id: string;
      levelId?: string;
      name: string;
      sourceHydrantId?: string;
      sourceHydrantNumber?: string;
      sourceHydrantAddress?: string;
      totalDistanceFeet: number;
      recommendedHoseFeet: number;
      hoseSizeInches: number;
      supplyLineLabel: string;
      apparatusCapacityFeet?: number;
      route: unknown[];
      notes?: string;
    }>;
    assets: Array<{
      id: string;
      hazmatId?: string;
      levelId?: string;
      category: string;
      filename: string;
      contentType: string;
      caption: string;
      pinToRespond: number;
      createdAt: string;
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

function isCachedRespondData(value: unknown): value is RespondData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RespondData>;
  return Boolean(
    candidate.departmentId &&
    candidate.activeCall?.reportNumber &&
    candidate.preplan?.id &&
    candidate.generatedAt,
  );
}
type QuickItem = {
  id: string;
  label: string;
  summary: string;
  details: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  levelId?: string;
  locationDescription?: string;
  verifiedAt?: string;
};
type RightView = "cad" | "floorplan" | "footprint" | "B" | "C" | "D";
const respondViews: RightView[] = [
  "cad",
  "floorplan",
  "footprint",
  "B",
  "C",
  "D",
];

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
const respondProgressLabels: Record<RespondProgressStatus, string> = {
  acknowledged: "Acknowledged",
  en_route: "En route",
  on_scene: "On scene",
};
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
function verificationDate(value?: string) {
  if (!value) return "Not verified";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not verified";
  return parsed.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function operationalColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function normalizedRoomPolygon(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const candidate = point as { x?: unknown; y?: unknown };
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      return Number.isFinite(x) &&
        Number.isFinite(y) &&
        x >= 0 &&
        x <= 1 &&
        y >= 0 &&
        y <= 1
        ? { x, y }
        : null;
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));
}

function FloorPlanView({
  asset,
  spaces,
  matchedRoomId,
}: {
  asset?: NonNullable<RespondData["operational"]>["assets"][number];
  spaces: NonNullable<RespondData["operational"]>["spaces"];
  matchedRoomId?: string;
}) {
  const imageAsset = asset?.contentType.startsWith("image/") ? asset : null;
  return (
    <div className="respond-floor-plan">
      <header>
        <span>TACTICAL FLOOR PLAN</span>
        <strong>
          {matchedRoomId
            ? "CAD room highlighted"
            : "No reliable CAD room highlight"}
        </strong>
      </header>
      {imageAsset ? (
        <div className="respond-floor-canvas">
          <img
            src={`/api/field-preplans/assets/${encodeURIComponent(imageAsset.id)}`}
            alt={
              imageAsset.caption ||
              imageAsset.filename ||
              "Published floor plan"
            }
          />
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label="Saved rooms over the published floor plan"
          >
            {spaces.map((space) => {
              const points = normalizedRoomPolygon(space.geometry);
              if (points.length < 3) return null;
              const center = points.reduce(
                (sum, point) => ({
                  x: sum.x + point.x / points.length,
                  y: sum.y + point.y / points.length,
                }),
                { x: 0, y: 0 },
              );
              return (
                <g
                  key={space.id}
                  className={space.id === matchedRoomId ? "matched" : ""}
                >
                  <polygon
                    points={points
                      .map((point) => `${point.x * 100},${point.y * 100}`)
                      .join(" ")}
                  />
                  <text
                    x={center.x * 100}
                    y={center.y * 100}
                    textAnchor="middle"
                  >
                    {space.roomNumber || space.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : asset ? (
        <a
          className="respond-floor-file"
          href={`/api/field-preplans/assets/${encodeURIComponent(asset.id)}`}
          target="_blank"
          rel="noreferrer"
        >
          Open private floor-plan file ↗
        </a>
      ) : (
        <div className="respond-empty compact">
          <strong>No floor plan published for this level</strong>
          <span>Room details remain available below when saved.</span>
        </div>
      )}
      <div className="respond-room-list" aria-label="Rooms on selected level">
        {spaces.length ? (
          spaces.map((space) => (
            <article
              key={space.id}
              className={space.id === matchedRoomId ? "matched" : ""}
            >
              <strong>{space.name}</strong>
              <span>
                {space.spaceType.replaceAll("_", " ")}
                {space.hazards ? ` · Hazard: ${space.hazards}` : ""}
              </span>
              {space.accessNotes && <small>Access: {space.accessNotes}</small>}
            </article>
          ))
        ) : (
          <span>No saved rooms on this level.</span>
        )}
      </div>
    </div>
  );
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
  onSelect: (item: QuickItem, trigger?: HTMLElement | null) => void;
}) {
  const featureItem = (feature: Preplan["features"][number]): QuickItem => ({
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
  });
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
        aria-hidden="true"
        focusable="false"
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
              onClick={() => onSelect(featureItem(feature))}
            >
              <circle cx={p.x} cy={p.y} r="5" />
              <text x={p.x} y={p.y + 1.4} textAnchor="middle">
                {featureSymbols[feature.featureType] || "•"}
              </text>
            </g>
          );
        })}
      </svg>
      <small aria-hidden="true">
        Tap a symbol for its quick location and system details.
      </small>
      <section
        className="respond-footprint-alternative"
        aria-labelledby="respond-mapped-systems-title"
      >
        <h3 id="respond-mapped-systems-title">Mapped system locations</h3>
        <p className="sr-only">
          Building footprint and mapped fire protection features are listed as
          text controls below.
        </p>
        {preplan.features.length ? (
          <ul>
            {preplan.features.map((feature) => {
              const item = featureItem(feature);
              return (
                <li key={feature.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === feature.id}
                    onClick={(event) => onSelect(item, event.currentTarget)}
                    data-test-safe
                  >
                    <strong>{item.label}</strong>
                    <span>
                      {item.summary || "System type not entered"} ·{" "}
                      {item.status?.replaceAll("_", " ") || "Status not reported"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No mapped fire-protection systems are published.</p>
        )}
      </section>
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
  const [showAllAttachments, setShowAllAttachments] = useState(false);
  const [selectedHazmatId, setSelectedHazmatId] = useState("");
  const [respondSource, setRespondSource] = useState<"live" | "offline">(
    "live",
  );
  const [cachedAt, setCachedAt] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [crewProgress, setCrewProgress] = useState<RespondProgress | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const arrivalRef = useRef<HTMLElement>(null);
  const tacticalRef = useRef<HTMLElement>(null);
  const hydrantRef = useRef<HTMLElement>(null);
  const departmentIdRef = useRef("");
  const hazmatCloseRef = useRef<HTMLButtonElement>(null);
  const hazmatTriggerRef = useRef<HTMLElement | null>(null);
  const quickCloseRef = useRef<HTMLButtonElement>(null);
  const quickTriggerRef = useRef<HTMLElement | null>(null);
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
      departmentIdRef.current = body.departmentId;
      setData(body);
      setRespondSource("live");
      setCachedAt("");
      setError("");
      if (body.activeCall && body.preplan && body.departmentId) {
        const savedAt = new Date().toISOString();
        await cacheRespondPacket({
          id: `${body.departmentId}:${apparatus || "all"}`,
          departmentId: body.departmentId,
          apparatus,
          cachedAt: savedAt,
          payload: body,
        }).catch(() => undefined);
      } else if (body.departmentId) {
        await removeCachedRespondPacket(body.departmentId, apparatus).catch(
          () => undefined,
        );
      }
    } catch (value) {
      const departmentId = departmentIdRef.current;
      if (departmentId) {
        const cached = await getCachedRespondPacket<RespondData>(
          departmentId,
          apparatus,
        ).catch(() => null);
        if (cached && isCachedRespondData(cached.payload)) {
          setData(cached.payload);
          setCachedAt(cached.cachedAt);
          setRespondSource("offline");
          setError("");
          return;
        }
        if (cached) await clearCachedRespondPackets().catch(() => undefined);
      }
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
      const online = window.navigator.onLine;
      setIsOnline(online);
      void load();
    };
    const initial = window.setTimeout(
      () => setIsOnline(window.navigator.onLine),
      0,
    );
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [load]);
  useEffect(() => {
    const reportNumber = data?.activeCall?.reportNumber;
    if (!reportNumber) {
      setCrewProgress(null);
      return;
    }
    setCrewProgress(
      readRespondProgress(window.localStorage, reportNumber, apparatus),
    );
  }, [apparatus, data?.activeCall?.reportNumber]);
  useEffect(() => {
    const update = () => {
      if (!document.fullscreenElement) setMonitorMode(false);
    };
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    if (selectedHazmatId) hazmatCloseRef.current?.focus();
  }, [selectedHazmatId]);
  useEffect(() => {
    if (selected) quickCloseRef.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (!selectedHazmatId && !selected) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (selectedHazmatId) {
        setSelectedHazmatId("");
        window.requestAnimationFrame(() => hazmatTriggerRef.current?.focus());
      } else {
        setSelected(null);
        window.requestAnimationFrame(() => quickTriggerRef.current?.focus());
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedHazmatId, selected]);
  function restoreFocus(target: HTMLElement | null) {
    window.requestAnimationFrame(() => target?.focus());
  }
  function openHazmatDetail(id: string, trigger?: HTMLElement | null) {
    hazmatTriggerRef.current = trigger ?? null;
    setSelectedHazmatId(id);
  }
  function closeHazmatDetail() {
    setSelectedHazmatId("");
    restoreFocus(hazmatTriggerRef.current);
  }
  function openQuickInformation(item: QuickItem, trigger?: HTMLElement | null) {
    quickTriggerRef.current = trigger ?? null;
    setSelected(item);
  }
  function closeQuickInformation(restore = true) {
    setSelected(null);
    if (restore) restoreFocus(quickTriggerRef.current);
  }
  function updateCrewProgress(status: RespondProgressStatus) {
    const reportNumber = data?.activeCall?.reportNumber;
    if (!reportNumber) return;
    const next = writeRespondProgress(
      window.localStorage,
      reportNumber,
      apparatus,
      status,
    );
    setCrewProgress(next);
    if (status === "on_scene") {
      window.requestAnimationFrame(() =>
        arrivalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }
  function openTacticalView(nextView: RightView) {
    setView(nextView);
    window.requestAnimationFrame(() => {
      tacticalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`respond-tab-${nextView}`)?.focus();
    });
  }
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
  function moveContextTab(
    event: KeyboardEvent<HTMLButtonElement>,
    current: RightView,
  ) {
    const index = respondViews.indexOf(current);
    const keyTargets: Partial<Record<string, number>> = {
      Home: 0,
      End: respondViews.length - 1,
      ArrowLeft: (index - 1 + respondViews.length) % respondViews.length,
      ArrowUp: (index - 1 + respondViews.length) % respondViews.length,
      ArrowRight: (index + 1) % respondViews.length,
      ArrowDown: (index + 1) % respondViews.length,
    };
    const target = keyTargets[event.key];
    if (target == null) return;
    event.preventDefault();
    setView(respondViews[target]);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll("button");
    buttons?.item(target).focus();
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
      levelId: feature.primaryLevelId,
      locationDescription: feature.details,
      verifiedAt: feature.verifiedAt,
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
      data?.operational?.levels.find(
        (level) => level.id === data.operational?.roomMatch?.room?.levelId,
      ) ??
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
      ) ?? [],
    visibleAttachments =
      data?.operational?.assets.filter(
        (item) => !item.levelId || item.levelId === selectedLevel?.id,
      ) ?? [],
    visibleSpaces =
      data?.operational?.spaces.filter(
        (space) => space.levelId === selectedLevel?.id,
      ) ?? [],
    floorPlanAsset = visibleAttachments.find(
      (asset) => asset.category.toLowerCase() === "floor_plan",
    ),
    pinnedAttachments = visibleAttachments.filter((item) =>
      Boolean(item.pinToRespond),
    ),
    shownAttachments = showAllAttachments
      ? visibleAttachments
      : pinnedAttachments,
    selectedHazmat = visibleHazmat.find((item) => item.id === selectedHazmatId),
    selectedHazmatZones = selectedHazmat
      ? (data?.operational?.hazmatZones.filter(
          (zone) =>
            zone.hazmatId === selectedHazmat.id &&
            (!zone.levelId || zone.levelId === selectedLevel?.id),
        ) ?? [])
      : [],
    selectedHazmatSds = selectedHazmat
      ? (data?.operational?.assets.filter(
          (asset) =>
            asset.hazmatId === selectedHazmat.id &&
            asset.category.toLowerCase() === "sds",
        ) ?? [])
      : [],
    visibleHoseLays =
      data?.operational?.hoseLays.filter(
        (item) => !item.levelId || item.levelId === selectedLevel?.id,
      ) ?? [],
    specialPopulations = data?.operational
      ? [
          data.operational.occupancy.nonAmbulatory === "yes"
            ? "Non-ambulatory"
            : null,
          data.operational.occupancy.sleepingOccupants === "yes"
            ? "Sleeping occupants"
            : null,
          data.operational.occupancy.children === "yes" ? "Children" : null,
          data.operational.occupancy.elderly === "yes" ? "Elderly" : null,
          data.operational.occupancy.assistanceNeeded === "yes"
            ? "Assistance needed"
            : null,
        ].filter(Boolean)
      : [],
    fireProtection = plan
      ? [plan.sprinklerSystem, plan.fdc, plan.riser, plan.alarmSystem].filter(
          Boolean,
        )
      : [],
    crewProgressIndex = crewProgress
      ? respondProgressSteps.indexOf(crewProgress.status)
      : -1;
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
  if (!call) {
    const overview: RespondOverview = data?.overview ?? {
      apparatus: null,
      preplans: [],
      hydrants: [],
      roadClosures: [],
    };
    const apparatusStatus = overview.apparatus
      ? respondApparatusStatusLabel(overview.apparatus.status)
      : "Status not reported";
    return (
      <section
        ref={pageRef}
        className={`respond-page respond-overview-page${monitorMode ? " monitor-view" : ""}`}
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
            <small>Live updates · checks every 10 seconds</small>
            <button onClick={() => void toggleMonitor()}>
              {monitorMode ? "Exit Monitor" : "Set up Monitor"}
            </button>
          </div>
        </header>
        <section
          className="respond-monitor-status"
          aria-label="Respond device status"
        >
          <div className="primary">
            <span>MONITORED APPARATUS</span>
            <strong>{apparatus ? `Unit ${apparatus}` : "Department view"}</strong>
          </div>
          <div>
            <span>FLEET STATUS</span>
            <strong>{apparatusStatus}</strong>
          </div>
          <div>
            <span>RESPONSE</span>
            <strong>No active call</strong>
          </div>
          <div>
            <span>LOCATION</span>
            <strong>GPS not connected</strong>
          </div>
          <small>Live records · no vehicle location is guessed</small>
        </section>
        {overview.roadClosures.length ? (
          <section
            className="respond-road-closure"
            aria-label="Active road closures"
          >
            <span>ACTIVE ROAD CLOSURE</span>
            <strong>
              {overview.roadClosures[0].roadName || "Road name not entered"}
            </strong>
            <p>
              {overview.roadClosures[0].reason ||
                "Access restriction is active until restored in Road Closures."}
              {overview.roadClosures.length > 1
                ? ` · ${overview.roadClosures.length - 1} more active`
                : ""}
            </p>
          </section>
        ) : null}
        <RespondOverviewMap
          overview={overview}
          recentCalls={data?.recentCalls ?? []}
          onNavigate={onNavigate}
        />
      </section>
    );
  }
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
      <section className="respond-field-toolbar" aria-label="Field response controls">
        <div className="respond-progress-panel">
          <div>
            <span>THIS DEVICE{apparatus ? ` · UNIT ${apparatus}` : ""}</span>
            <strong>Response progress</strong>
            <small>
              {crewProgress
                ? `${respondProgressLabels[crewProgress.status]} · ${displayTime(crewProgress.updatedAt)}`
                : "Select the crew's current step"}
            </small>
          </div>
          <div className="respond-progress-steps" role="group" aria-label="Crew response progress on this device">
            {respondProgressSteps.map((status, index) => {
              const isCurrent = crewProgress?.status === status;
              const isComplete = index < crewProgressIndex;
              return (
                <button
                  key={status}
                  type="button"
                  className={isCurrent ? "current" : isComplete ? "complete" : ""}
                  aria-pressed={isCurrent}
                  onClick={() => updateCrewProgress(status)}
                  data-test-safe
                >
                  <b>{index + 1}</b>
                  <span>{respondProgressLabels[status]}</span>
                </button>
              );
            })}
          </div>
          <small className="respond-progress-note">
            Saved on this browser only · does not change CAD status
          </small>
        </div>
        <nav className="respond-jump-actions" aria-label="Open response information">
          <button type="button" onClick={() => openTacticalView("cad")}>
            <b>CAD</b>
            <span>Latest notes</span>
          </button>
          <button
            type="button"
            onClick={() => openTacticalView("floorplan")}
            disabled={!floorPlanAsset}
          >
            <b>Floor plan</b>
            <span>{floorPlanAsset ? selectedLevel?.name || "Open level" : "Not published"}</span>
          </button>
          <button
            type="button"
            onClick={() => openTacticalView("footprint")}
            disabled={!plan}
          >
            <b>Footprint</b>
            <span>{plan ? "Systems map" : "No preplan"}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              hydrantRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }
            disabled={!data?.nearestHydrants?.length}
          >
            <b>Hydrant</b>
            <span>
              {data?.nearestHydrants?.length
                ? `${data.nearestHydrants[0].distanceFeet.toLocaleString()} ft away`
                : "None verified"}
            </span>
          </button>
        </nav>
      </section>
      {respondSource === "offline" && (
        <section className="respond-offline-banner" role="status">
          <strong>OFFLINE — READ-ONLY PREPLAN</strong>
          <span>
            Using the last published response packet saved at{" "}
            {verificationDate(cachedAt)}. It may not reflect current conditions.
          </span>
          <small>
            Live CAD updates, private files, navigation, and current hydrant
            status may be unavailable until the connection returns.
          </small>
        </section>
      )}
      {!isOnline && respondSource !== "offline" && (
        <section className="respond-offline-banner unavailable" role="status">
          <strong>OFFLINE — NO MATCHED PREPLAN CACHE</strong>
          <span>
            No cached active-call packet is available for this device.
          </span>
        </section>
      )}
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
                    closeQuickInformation(false);
                  }}
                >
                  {level.shortLabel || level.name}
                </button>
              ))}
            </div>
          </nav>
          <section
            ref={arrivalRef}
            className="respond-operational-banner"
            aria-label="Published operational preplan intelligence"
          >
            <header>
              <span>
                PREPLAN 2.0 · REV{" "}
                {data.operational.revision?.revisionNumber ?? "LEGACY"} ·{" "}
                {selectedLevel?.name || "Arrival / Ground"}
              </span>
              {data.operational.roomMatch?.room ? (
                <button
                  className="respond-room-match-action"
                  onClick={() => {
                    setSelectedLevelId(
                      data.operational?.roomMatch?.room?.levelId || "",
                    );
                    setView("floorplan");
                  }}
                >
                  Open matched room · {data.operational.roomMatch.room.name}
                </button>
              ) : (
                <strong>No reliable CAD room match</strong>
              )}
            </header>
            <div>
              {plan?.targetHazardLevel &&
                (plan.targetHazardLevel !== "low" ||
                  Boolean(plan.targetHazardReasons?.length)) && (
                  <article className="critical target-hazard">
                    <b>
                      TARGET HAZARD · {plan.targetHazardLevel.toUpperCase()}
                    </b>
                    <strong>{plan.businessName || plan.address}</strong>
                    <span>
                      Published score {Number(plan.targetHazardScore ?? 0)}
                      {Number(plan.targetHazardOverride ?? 0) !== 0
                        ? ` · Factors ${Number(plan.targetHazardFactorScore ?? 0)} · Authorized override ${Number(plan.targetHazardOverride) > 0 ? "+" : ""}${Number(plan.targetHazardOverride)}`
                        : ""}
                    </span>
                    <span>
                      {plan.targetHazardReasons?.length
                        ? plan.targetHazardReasons.join(" · ")
                        : "Target-hazard classification is published; review the full preplan."}
                    </span>
                  </article>
                )}
              {plan?.accessInfo?.trim() && (
                <article className="warning access-problem">
                  <b>ACCESS PROBLEM / ENTRY NOTE</b>
                  <strong>Published access intelligence</strong>
                  <span>{plan.accessInfo}</span>
                </article>
              )}
              {visibleAlerts.slice(0, 3).map((alert) => (
                <article
                  key={alert.id}
                  className={`${alert.severity}${alert.expiredUnverified ? " expired-unverified" : ""}`}
                >
                  <b>
                    {alert.expiredUnverified
                      ? "EXPIRED — VERIFY"
                      : alert.alertType?.toLowerCase().includes("command")
                        ? "COMMAND NOTE"
                        : alert.effectiveAt || alert.expiresAt
                          ? "TEMPORARY HAZARD"
                          : alert.severity.toUpperCase()}
                  </b>
                  <strong>{alert.title}</strong>
                  <span>{alert.message}</span>
                </article>
              ))}
              {visibleHazmat.slice(0, 3).map((item) => (
                <article key={item.id} className="hazmat">
                  <button onClick={(event) => openHazmatDetail(item.id, event.currentTarget)}>
                    <b>HAZMAT · OPEN DETAIL</b>
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
                  </button>
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
          {selectedHazmat && (
            <section
              className="respond-hazmat-detail"
              role="dialog"
              aria-modal="false"
              aria-labelledby="respond-hazmat-detail-title"
            >
              <header>
                <div>
                  <span>HAZMAT EMERGENCY DETAIL</span>
                  <h2 id="respond-hazmat-detail-title">{selectedHazmat.materialName}</h2>
                  <strong>
                    {selectedHazmat.unNumber
                      ? `UN/NA ${selectedHazmat.unNumber}`
                      : "UN/NA not entered"}{" "}
                    ·{" "}
                    {selectedHazmat.ergGuideNumber
                      ? `ERG ${selectedHazmat.ergGuideNumber}`
                      : "Verify in official ERG"}
                  </strong>
                </div>
                <button
                  ref={hazmatCloseRef}
                  onClick={closeHazmatDetail}
                  aria-label="Close HazMat detail"
                >
                  ×
                </button>
              </header>
              <dl>
                <div>
                  <dt>Quantity / container</dt>
                  <dd>
                    {selectedHazmat.quantity != null
                      ? `${selectedHazmat.quantity} ${selectedHazmat.quantityUnit || "units"}`
                      : "Quantity not verified"}{" "}
                    · {selectedHazmat.storageType || "Container not entered"}
                  </dd>
                </div>
                <div>
                  <dt>Physical state</dt>
                  <dd>{selectedHazmat.physicalState || "Not entered"}</dd>
                </div>
                <div>
                  <dt>Exact location</dt>
                  <dd>
                    {selectedHazmat.exactLocation ||
                      "Exact location not entered"}
                  </dd>
                </div>
                <div>
                  <dt>NFPA 704</dt>
                  <dd>
                    Health {selectedHazmat.nfpaHealth ?? "?"} · Flammability{" "}
                    {selectedHazmat.nfpaFlammability ?? "?"} · Instability{" "}
                    {selectedHazmat.nfpaInstability ?? "?"}
                    {selectedHazmat.nfpaSpecial
                      ? ` · ${selectedHazmat.nfpaSpecial}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Date verified</dt>
                  <dd>{verificationDate(selectedHazmat.dateVerified)}</dd>
                </div>
                <div>
                  <dt>Isolation / evacuation zones</dt>
                  <dd>
                    {selectedHazmatZones.length
                      ? selectedHazmatZones
                          .map(
                            (zone) =>
                              `${zone.label || zone.zoneType}${zone.radiusFeet ? ` · ${zone.radiusFeet} ft` : ""}`,
                          )
                          .join("; ")
                      : "No active zones recorded"}
                  </dd>
                </div>
                <div>
                  <dt>SDS</dt>
                  <dd>
                    {selectedHazmatSds.length
                      ? selectedHazmatSds.map((asset) => (
                          <a
                            key={asset.id}
                            href={`/api/field-preplans/assets/${encodeURIComponent(asset.id)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {asset.caption || asset.filename} ↗
                          </a>
                        ))
                      : "No SDS attachment recorded"}
                  </dd>
                </div>
              </dl>
              {selectedHazmatZones.length > 0 && (
                <section
                  className="respond-hazmat-zones"
                  aria-label="Active HazMat isolation and evacuation zones"
                >
                  <header>
                    <strong>ACTIVE OPERATIONAL ZONES</strong>
                    <span>
                      {selectedLevel?.name || "Arrival / Ground"} · Confirm wind
                      and current official guidance
                    </span>
                  </header>
                  <div>
                    {selectedHazmatZones.map((zone) => {
                      const mapped = zone.geometry != null;
                      return (
                        <article key={zone.id}>
                          <span
                            className="respond-zone-symbol"
                            style={{
                              borderColor: operationalColor(
                                zone.lineColor,
                                "#ef4444",
                              ),
                              backgroundColor: operationalColor(
                                zone.fillColor,
                                "#7f1d1d",
                              ),
                              opacity:
                                zone.opacity == null
                                  ? 0.85
                                  : Math.min(1, Math.max(0.35, zone.opacity)),
                            }}
                            aria-hidden="true"
                          />
                          <div>
                            <b>{zone.zoneType.toUpperCase()} ZONE</b>
                            <strong>{zone.label || "Unlabeled zone"}</strong>
                            <span>
                              {zone.radiusFeet
                                ? `${zone.radiusFeet.toLocaleString()} ft radius`
                                : "Distance not recorded"}
                              {" · "}
                              {mapped
                                ? `${zone.geometryType} geometry mapped`
                                : "Location not mapped"}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <small>
                    Saved preplan zones are planning references. Do not infer a
                    distance when none is recorded.
                  </small>
                </section>
              )}
              <p>
                <strong>Operational warning:</strong>{" "}
                {selectedHazmat.notes ||
                  "Confirm conditions, container integrity, wind, isolation distance, and the current official ERG before entry."}
              </p>
            </section>
          )}
        </>
      )}
      {plan && (
        <section
          className="respond-quick-building"
          aria-label="Quick building intelligence"
        >
          <header>
            <span>FIRST 30 SECONDS</span>
            <h2>Quick building intelligence</h2>
          </header>
          <dl>
            <div>
              <dt>Construction</dt>
              <dd>
                {data?.operational?.construction.constructionType ||
                  plan.constructionType ||
                  plan.construction ||
                  "Not verified"}
              </dd>
            </div>
            <div>
              <dt>Floors</dt>
              <dd>
                Above{" "}
                {data?.operational?.construction.floorsAboveGrade ??
                  plan.floorCount ??
                  "?"}{" "}
                · Below{" "}
                {data?.operational?.construction.floorsBelowGrade ??
                  "Not verified"}
              </dd>
            </div>
            <div>
              <dt>Building area</dt>
              <dd>
                {plan.footprintSquareFeet > 0
                  ? `${Math.round(plan.footprintSquareFeet).toLocaleString()} sq ft`
                  : "Not verified"}
              </dd>
            </div>
            <div>
              <dt>Advisory fire flow</dt>
              <dd>
                {plan.suggestedFireFlowGpm > 0
                  ? `${Math.round(plan.suggestedFireFlowGpm).toLocaleString()} GPM · ${plan.suggestedFireFlowDuration || "?"} hr`
                  : "Not calculated"}
              </dd>
            </div>
            <div>
              <dt>Occupancy</dt>
              <dd>
                {data?.operational?.occupancy.classification || "Not verified"}
              </dd>
            </div>
            <div>
              <dt>Special population</dt>
              <dd>
                {specialPopulations.length
                  ? specialPopulations.join(" · ")
                  : "None verified"}
              </dd>
            </div>
            <div>
              <dt>Fire protection</dt>
              <dd>
                {fireProtection.length
                  ? fireProtection.join(" · ")
                  : "Not verified"}
              </dd>
            </div>
            <div>
              <dt>Contacts</dt>
              <dd>{plan.contactInfo || "No emergency contact recorded"}</dd>
            </div>
            <div>
              <dt>Water supply</dt>
              <dd>
                {data?.nearestHydrants?.length
                  ? `${data.nearestHydrants.length} mapped nearby · nearest ${data.nearestHydrants[0].distanceFeet.toLocaleString()} ft · ${data.nearestHydrants[0].serviceStatus.replaceAll("_", " ")}`
                  : "No verified nearby hydrant"}
              </dd>
            </div>
          </dl>
          <p>
            Fire-flow value is an advisory planning estimate. Confirm adopted
            code requirements, sprinkler demand, hose allowance, and current
            water-supply conditions.
          </p>
        </section>
      )}
      <section
        ref={hydrantRef}
        className="respond-glance"
        aria-label="Matched response records"
      >
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
      {data?.operational && (
        <section
          className="respond-attachments"
          aria-label="Published preplan attachments"
        >
          <header>
            <div>
              <span>
                SECURE ATTACHMENTS · {selectedLevel?.name || "ARRIVAL"}
              </span>
              <h2>
                {showAllAttachments ? "All attachments" : "Pinned to Respond"}
              </h2>
            </div>
            {visibleAttachments.length > pinnedAttachments.length && (
              <button
                onClick={() => setShowAllAttachments((current) => !current)}
                aria-expanded={showAllAttachments}
              >
                {showAllAttachments
                  ? "Show pinned only"
                  : `Open all attachments (${visibleAttachments.length})`}
              </button>
            )}
          </header>
          {shownAttachments.length ? (
            <div>
              {shownAttachments.map((item) => (
                <a
                  key={item.id}
                  href={`/api/field-preplans/assets/${encodeURIComponent(item.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <b>{item.caption || item.filename}</b>
                  <span>{item.category.replaceAll("_", " ")}</span>
                  <small>Open private attachment ↗</small>
                </a>
              ))}
            </div>
          ) : (
            <p>
              {visibleAttachments.length
                ? "No attachments are pinned to Respond for this level."
                : "No published attachments are available for this level."}
            </p>
          )}
        </section>
      )}
      {data?.operational && (
        <section
          className="respond-hose-lays"
          aria-label="Saved hose lay options"
        >
          <header>
            <div>
              <span>WATER SUPPLY · {selectedLevel?.name || "ARRIVAL"}</span>
              <h2>Saved hose-lay options</h2>
            </div>
            <small>
              Each option is independent. Do not combine hydrant flows without a
              verified water-main relationship.
            </small>
          </header>
          {visibleHoseLays.length ? (
            <div>
              {visibleHoseLays.map((lay) => {
                const deficit =
                  lay.apparatusCapacityFeet != null
                    ? Math.max(
                        0,
                        lay.recommendedHoseFeet - lay.apparatusCapacityFeet,
                      )
                    : null;
                return (
                  <article
                    key={lay.id}
                    className={deficit && deficit > 0 ? "deficit" : ""}
                  >
                    <header>
                      <strong>{lay.name}</strong>
                      <b>
                        {lay.supplyLineLabel ||
                          `${lay.hoseSizeInches}-inch supply`}
                      </b>
                    </header>
                    <dl>
                      <div>
                        <dt>Source hydrant</dt>
                        <dd>
                          {lay.sourceHydrantNumber ||
                            lay.sourceHydrantAddress ||
                            lay.sourceHydrantId ||
                            "Hydrant not verified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Route distance</dt>
                        <dd>
                          {lay.totalDistanceFeet > 0
                            ? `${Math.round(lay.totalDistanceFeet).toLocaleString()} ft`
                            : "Distance not verified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Recommended hose</dt>
                        <dd>
                          {Math.round(lay.recommendedHoseFeet).toLocaleString()}{" "}
                          ft · {lay.hoseSizeInches || "?"} in
                        </dd>
                      </div>
                      <div>
                        <dt>Apparatus capacity</dt>
                        <dd>
                          {lay.apparatusCapacityFeet != null
                            ? `${Math.round(lay.apparatusCapacityFeet).toLocaleString()} ft`
                            : "Inventory not verified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Route</dt>
                        <dd>
                          {lay.route.length >= 2
                            ? `Saved route · ${lay.route.length} points`
                            : "No saved route geometry"}
                        </dd>
                      </div>
                    </dl>
                    {deficit != null && deficit > 0 ? (
                      <p>
                        <strong>DEFICIT:</strong>{" "}
                        {Math.round(deficit).toLocaleString()} additional feet
                        required beyond verified apparatus capacity.
                      </p>
                    ) : (
                      <p>
                        {lay.apparatusCapacityFeet == null
                          ? "Capacity comparison unavailable until apparatus inventory is verified."
                          : "Verified apparatus capacity covers this recommendation."}
                      </p>
                    )}
                    {lay.notes && <small>{lay.notes}</small>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>No saved hose-lay option is published for this level.</p>
          )}
        </section>
      )}
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
                onClick={(event) => openQuickInformation(item, event.currentTarget)}
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
        <aside ref={tacticalRef} className="respond-context">
          <nav role="tablist" aria-label="Response tactical views">
            {respondViews.map((item) => (
              <button
                key={item}
                id={`respond-tab-${item}`}
                role="tab"
                aria-selected={view === item}
                aria-controls={`respond-panel-${item}`}
                tabIndex={view === item ? 0 : -1}
                className={view === item ? "active" : ""}
                onClick={() => setView(item)}
                onKeyDown={(event) => moveContextTab(event, item)}
                data-test-safe
              >
                {item === "cad"
                  ? "CAD Notes"
                  : item === "floorplan"
                    ? "Floor Plan"
                    : item === "footprint"
                      ? "Footprint"
                      : `${item} Side`}
              </button>
            ))}
          </nav>
          <div
            id={`respond-panel-${view}`}
            role="tabpanel"
            aria-labelledby={`respond-tab-${view}`}
            tabIndex={0}
            className="respond-context-body"
          >
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
            {view === "floorplan" && (
              <FloorPlanView
                asset={floorPlanAsset}
                spaces={visibleSpaces}
                matchedRoomId={data?.operational?.roomMatch?.room?.id}
              />
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
                    onSelect={openQuickInformation}
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
        role={selected ? "dialog" : "status"}
        aria-modal={selected ? "false" : undefined}
        aria-labelledby={selected ? "respond-quick-information-title" : undefined}
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
              <h2 id="respond-quick-information-title">{selected.label}</h2>
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
              {!selected.id.startsWith("summary-") && (
                <>
                  <div>
                    <dt>Published level</dt>
                    <dd>
                      {data?.operational?.levels.find(
                        (level) => level.id === selected.levelId,
                      )?.name || "Arrival / Ground"}
                    </dd>
                  </div>
                  <div>
                    <dt>Location description</dt>
                    <dd>
                      {selected.locationDescription ||
                        "No location description entered."}
                    </dd>
                  </div>
                  <div>
                    <dt>Last verification</dt>
                    <dd>{verificationDate(selected.verifiedAt)}</dd>
                  </div>
                </>
              )}
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
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}&travelmode=walking`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Walking directions ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <button
              ref={quickCloseRef}
              onClick={() => closeQuickInformation()}
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
