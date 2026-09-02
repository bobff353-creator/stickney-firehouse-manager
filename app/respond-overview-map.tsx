"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GoogleFieldMap from "./google-field-map";
import { clusterRecentCallLocations } from "./respond-call-clusters";
import { formatRespondMilitaryTime } from "./respond-time";
import { clusterHydrantLocations, hasMapLocation, projectMapPoint } from "./respond-map-markers";

type Point = { lat: number; lng: number };
export type RespondOverview = {
  apparatus: null | { unit: string; name: string; status: string };
  preplans: Array<{
    id: string;
    businessName: string;
    address: string;
    latitude: number;
    longitude: number;
  }>;
  hydrants: Array<{
    id: string;
    hydrantNumber: string;
    address: string;
    latitude: number;
    longitude: number;
    serviceStatus: string;
  }>;
  roadClosures: Array<{
    id: string;
    roadName: string;
    reason: string;
    expectedClearAt: string | null;
    path: Point[];
  }>;
};

type RecentCall = {
  reportNumber: string;
  callType: string;
  address: string;
  respondingUnits: string;
  timeOut: string;
  timeIn: string;
  logDate: string;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string;
};

const stickneyCenter: Point = { lat: 41.8189, lng: -87.7734 };

function initialCallMapView(calls: RecentCall[]) {
  const clusters = clusterRecentCallLocations(calls);
  if (!clusters.length) return { center: stickneyCenter, zoom: 16 };
  const latitudes = clusters.map((cluster) => cluster.latitude);
  const longitudes = clusters.map((cluster) => cluster.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const span = Math.max(latitudeSpan, longitudeSpan);
  return {
    center: {
      lat: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
      lng: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    },
    zoom: span > 0.055 ? 14 : span > 0.022 ? 15 : 16,
  };
}

function HydrantMapSymbol() {
  return <svg viewBox="0 0 32 40" aria-hidden="true"><path d="M11 4h10v5h4v5h3v7h-5v14H9V21H4v-7h3V9h4V4Zm1 9v6h8v-6h-8Zm0 10v9h8v-9h-8Z"/></svg>;
}

function statusLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "in_service") return "In service";
  if (normalized === "out_of_service") return "Out of service";
  if (normalized === "impaired") return "Impaired";
  return "Status not reported";
}

export default function RespondOverviewMap({
  overview,
  recentCalls,
  onNavigate,
  updatesAvailable = true,
}: {
  overview: RespondOverview;
  recentCalls: RecentCall[];
  updatesAvailable?: boolean;
  onNavigate?: (page: "Daily Log" | "Field Preplans" | "Box Cards") => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [selectedHydrantIds, setSelectedHydrantIds] = useState<string[]>([]);
  const callClusters = useMemo(
    () => clusterRecentCallLocations(recentCalls),
    [recentCalls],
  );
  const [initialView] = useState(() => initialCallMapView(recentCalls));
  const [apiKey, setApiKey] = useState("");
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [imagery, setImagery] = useState<"aerial" | "street">("aerial");
  const [center, setCenter] = useState(initialView.center);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [rail, setRail] = useState<"active" | "recent">("active");
  const [selectedCallClusterId, setSelectedCallClusterId] = useState("");
  const [layers, setLayers] = useState({
    calls: true,
    preplans: true,
    hydrants: true,
    closures: true,
  });

  useEffect(() => {
    const element = mapElement.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setCanvas(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/maps-config", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          configured?: boolean;
          apiKey?: string;
        };
        if (!active) return;
        if (response.ok && body.configured && body.apiKey) setApiKey(body.apiKey);
        else setMapUnavailable(true);
      })
      .catch(() => {
        if (active) setMapUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const preplanMarkers = useMemo(
    () =>
      overview.preplans.filter(hasMapLocation)
        .map((plan) => ({
          plan,
          point: projectMapPoint(
            { lat: plan.latitude, lng: plan.longitude },
            center,
            zoom,
            canvas,
          ),
        }))
        .filter(
          ({ point }) =>
            point.x >= -50 &&
            point.x <= canvas.width + 50 &&
            point.y >= -50 &&
            point.y <= canvas.height + 50,
        ),
    [canvas, center, overview.preplans, zoom],
  );
  const hydrantClusters = useMemo(() => clusterHydrantLocations(overview.hydrants, zoom), [overview.hydrants, zoom]);
  const hydrantMarkers = useMemo(
    () =>
      hydrantClusters
        .map((cluster) => ({
          cluster,
          point: projectMapPoint(
            { lat: cluster.latitude, lng: cluster.longitude },
            center,
            zoom,
            canvas,
          ),
        }))
        .filter(
          ({ point }) =>
            point.x >= -50 &&
            point.x <= canvas.width + 50 &&
            point.y >= -50 &&
            point.y <= canvas.height + 50,
        ),
    [canvas, center, hydrantClusters, zoom],
  );
  const closureLines = useMemo(
    () =>
      overview.roadClosures.map((closure) => ({
        closure,
        points: closure.path
          .map((point) => {
            const item = projectMapPoint(point, center, zoom, canvas);
            return `${item.x},${item.y}`;
          })
          .join(" "),
      })),
    [canvas, center, overview.roadClosures, zoom],
  );
  const callMarkers = useMemo(
    () =>
      callClusters
        .map((cluster) => ({
          cluster,
          point: projectMapPoint(
            { lat: cluster.latitude, lng: cluster.longitude },
            center,
            zoom,
            canvas,
          ),
        }))
        .filter(
          ({ point }) =>
            point.x >= -50 &&
            point.x <= canvas.width + 50 &&
            point.y >= -50 &&
            point.y <= canvas.height + 50,
        ),
    [canvas, callClusters, center, zoom],
  );
  const selectedHydrants = overview.hydrants.filter(hydrant => selectedHydrantIds.includes(hydrant.id));
  const selectedCallCluster = callClusters.find(
    (cluster) => cluster.id === selectedCallClusterId,
  );
  const mappedCallCount = callClusters.reduce(
    (total, cluster) => total + cluster.calls.length,
    0,
  );
  const displayedRecentCalls = selectedCallCluster?.calls ?? recentCalls;
  const guide = selectedCallCluster
    ? {
        step: 3,
        title: "Call selected",
        text: "Confirm the address and call details shown beside the map.",
      }
    : rail === "recent"
      ? {
          step: 2,
          title: "Choose a recent call",
          text: "Tap a red map dot or a call card. A number means several calls share that area.",
        }
      : {
          step: 1,
          title: "Choose what you need",
          text: "Review a recent call or enter a manual call. New CAD calls open automatically.",
        };

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
    if (layer === "hydrants") setSelectedHydrantIds([]);
  }

  function openHydrantRecord(hydrant: RespondOverview["hydrants"][number]) {
    const url = new URL(window.location.href);
    url.searchParams.set("hydrant", hydrant.id);
    url.searchParams.delete("preplan");
    url.searchParams.delete("edit");
    window.history.replaceState({}, "", url);
    onNavigate?.("Field Preplans");
  }

  function selectHydrantCluster(cluster: (typeof hydrantClusters)[number]) {
    setSelectedHydrantIds(cluster.hydrants.map(hydrant => hydrant.id));
    setCenter({ lat: cluster.latitude, lng: cluster.longitude });
    if (cluster.hydrants.length > 1) setZoom(current => Math.min(21, current + 2));
  }

  function selectCallCluster(cluster: (typeof callClusters)[number]) {
    setSelectedHydrantIds([]);
    setSelectedCallClusterId(cluster.id);
    setRail("recent");
    setCenter({ lat: cluster.latitude, lng: cluster.longitude });
    setZoom((current) => Math.max(current, 17));
  }

  function showAllRecentCalls() {
    setSelectedCallClusterId("");
    setCenter(initialView.center);
    setZoom(initialView.zoom);
  }

  return (
    <section className="respond-map-shell" aria-label="Stickney response map">
      <section className="respond-task-guide" aria-live="polite">
        <b>Step {guide.step}</b>
        <div>
          <strong>{guide.title}</strong>
          <span>{guide.text}</span>
        </div>
        <div className="respond-task-actions">
          {guide.step === 1 ? (
            <>
              <button
                type="button"
                className="primary"
                onClick={() => setRail("recent")}
                disabled={!recentCalls.length}
              >
                Review recent calls ({recentCalls.length})
              </button>
              <button type="button" onClick={() => onNavigate?.("Daily Log")}>
                Enter a manual call
              </button>
            </>
          ) : guide.step === 2 ? (
            <button type="button" onClick={() => setRail("active")}>
              Back to current status
            </button>
          ) : (
            <button
              type="button"
              onClick={showAllRecentCalls}
            >
              Show all recent calls
            </button>
          )}
        </div>
      </section>

      <details className="respond-map-options">
        <summary>
          Map options
          <span>{imagery === "aerial" ? "Aerial" : "Streets"} · choose visible records</span>
        </summary>
      <nav className="respond-map-controls" aria-label="Response map layers">
        <div className="respond-map-style-switcher">
          <button
            type="button"
            className={imagery === "aerial" ? "active" : ""}
            aria-pressed={imagery === "aerial"}
            onClick={() => setImagery("aerial")}
          >
            Aerial
          </button>
          <button
            type="button"
            className={imagery === "street" ? "active" : ""}
            aria-pressed={imagery === "street"}
            onClick={() => setImagery("street")}
          >
            Streets
          </button>
        </div>
        <button
          type="button"
          className={layers.calls ? "active" : ""}
          aria-pressed={layers.calls}
          onClick={() => toggleLayer("calls")}
        >
          <i className="call" /> Calls <b>{mappedCallCount}</b>
        </button>
        <button
          type="button"
          className={layers.preplans ? "active" : ""}
          aria-pressed={layers.preplans}
          onClick={() => toggleLayer("preplans")}
        >
          <i className="preplan" /> Preplans <b>{overview.preplans.length}</b>
        </button>
        <button
          type="button"
          className={layers.hydrants ? "active" : ""}
          aria-pressed={layers.hydrants}
          onClick={() => toggleLayer("hydrants")}
        >
          <i className="hydrant" /> Hydrants <b>{overview.hydrants.length}</b>
        </button>
        <button
          type="button"
          className={layers.closures ? "active" : ""}
          aria-pressed={layers.closures}
          onClick={() => toggleLayer("closures")}
        >
          <i className="closure" /> Road closures{" "}
          <b>{overview.roadClosures.length}</b>
        </button>
        <span />
        <button
          type="button"
          className="respond-map-zoom"
          aria-label="Zoom out"
          onClick={() => setZoom((current) => Math.max(14, current - 1))}
        >
          −
        </button>
        <small>Zoom {zoom}</small>
        <button
          type="button"
          className="respond-map-zoom"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => Math.min(21, current + 1))}
        >
          +
        </button>
      </nav>
      </details>

      <div className="respond-map-key" aria-label="Map symbol key">
        <strong>Map key</strong>
        <span><i className="call" /> Recent call</span>
        <span><i className="preplan" /> P: preplan</span>
        <span className="respond-hydrant-key"><HydrantMapSymbol /> Hydrant</span>
        <span className="respond-hydrant-key unavailable"><HydrantMapSymbol /> Out of service</span>
        <span><b className="respond-group-key">12</b> Group · tap to zoom</span>
        <span><i className="closure" /> Red line: road closure</span>
      </div>

      <div className="respond-map-layout">
        <div className="respond-overview-map" ref={mapElement}>
          {apiKey ? (
            <GoogleFieldMap
              apiKey={apiKey}
              center={center}
              zoom={zoom}
              imagery={imagery}
              interactive
              onReady={(ready) => setMapUnavailable(!ready)}
              onViewChange={(nextCenter, nextZoom) => {
                setCenter(nextCenter);
                setZoom(nextZoom);
              }}
            />
          ) : null}
          {mapUnavailable ? (
            <div className="respond-map-unavailable">
              <strong>Map connection unavailable</strong>
              <span>
                Stickney records remain available in Field Preplans. No vehicle
                location is being guessed.
              </span>
              <button type="button" onClick={() => onNavigate?.("Field Preplans")}>
                Open Field Preplans
              </button>
            </div>
          ) : null}
          <svg
            className="respond-map-overlay"
            viewBox={`0 0 ${Math.max(1, canvas.width)} ${Math.max(1, canvas.height)}`}
            aria-hidden="true"
          >
            {layers.closures
              ? closureLines.map(({ closure, points }) =>
                  closure.path.length > 1 ? (
                    <polyline key={closure.id} points={points} />
                  ) : null,
                )
              : null}
          </svg>
          {layers.preplans && canvas.width > 0
            ? preplanMarkers.map(({ plan, point }) => (
                <button
                  type="button"
                  key={plan.id}
                  className="respond-map-marker preplan"
                  style={{
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                  }}
                  aria-label={`Open preplan for ${plan.businessName || plan.address}`}
                  title={`${plan.businessName || "Preplan"} · ${plan.address}`}
                  onClick={() => onNavigate?.("Field Preplans")}
                >
                  <span className="respond-preplan-symbol" aria-hidden="true">P</span>
                </button>
              ))
            : null}
          {layers.hydrants && canvas.width > 0
            ? hydrantMarkers.map(({ cluster, point }) => (
                <button
                  type="button"
                  key={cluster.id}
                  className={`respond-map-marker hydrant${cluster.hydrants.length > 1 ? " grouped" : ""}${cluster.outOfService === cluster.hydrants.length ? " out_of_service" : cluster.needsAttention ? " needs-attention" : ""}`}
                  style={{
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                  }}
                  aria-label={cluster.hydrants.length > 1
                    ? `Show ${cluster.hydrants.length} hydrants in this area${cluster.outOfService ? `, ${cluster.outOfService} out of service` : ""}${cluster.needsAttention > cluster.outOfService ? ", status needs review" : ""}`
                    : `Show hydrant ${cluster.hydrants[0].hydrantNumber || cluster.hydrants[0].address}, ${statusLabel(cluster.hydrants[0].serviceStatus)}`}
                  title={cluster.hydrants.length > 1
                    ? `${cluster.hydrants.length} hydrants · tap to zoom${cluster.needsAttention ? " · service status needs attention" : ""}`
                    : `${cluster.hydrants[0].hydrantNumber || "Hydrant"} · ${statusLabel(cluster.hydrants[0].serviceStatus)} · ${cluster.hydrants[0].address || "Address not entered"}`}
                  onClick={() => selectHydrantCluster(cluster)}
                >
                  <span className="respond-hydrant-symbol" aria-hidden="true"><HydrantMapSymbol />{cluster.hydrants.length > 1 ? <b>{cluster.hydrants.length}</b> : null}{cluster.needsAttention ? <i>!</i> : null}</span>
                </button>
              ))
            : null}
          {layers.calls && canvas.width > 0
            ? callMarkers.map(({ cluster, point }) => (
                <button
                  type="button"
                  key={cluster.id}
                  className={`respond-map-marker call${cluster.calls.length > 1 ? " cluster" : ""}${selectedCallClusterId === cluster.id ? " selected" : ""}`}
                  style={{
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                  }}
                  aria-label={
                    cluster.calls.length > 1
                      ? `Show ${cluster.calls.length} recent calls at this location`
                      : `Show recent call at ${cluster.calls[0].address || "saved location"}`
                  }
                  title={
                    cluster.calls.length > 1
                      ? `${cluster.calls.length} recent calls at this location`
                      : `${cluster.calls[0].callType || "Recent call"} · ${cluster.calls[0].address || "Saved location"}`
                  }
                  onClick={() => selectCallCluster(cluster)}
                  aria-pressed={selectedCallClusterId === cluster.id}
                >
                  <span className="respond-call-symbol" aria-hidden="true">{cluster.calls.length > 1 ? cluster.calls.length : ""}</span>
                </button>
              ))
            : null}
          {layers.hydrants && selectedHydrants.length ? (
            <section className="respond-hydrant-selection" aria-label="Selected hydrants">
              <header><strong>{selectedHydrants.length === 1 ? "Selected hydrant" : `${selectedHydrants.length} hydrants in this area`}</strong><button type="button" aria-label="Close hydrant selection" onClick={() => setSelectedHydrantIds([])}>×</button></header>
              <div>{selectedHydrants.map(hydrant => <button type="button" key={hydrant.id} disabled={!onNavigate} onClick={() => openHydrantRecord(hydrant)}><strong>{hydrant.hydrantNumber || "Hydrant"}<span className={hydrant.serviceStatus}>{statusLabel(hydrant.serviceStatus)}</span></strong><span>{hydrant.address || "Address not entered"}</span><small>Open hydrant record →</small></button>)}</div>
            </section>
          ) : null}
        </div>

        <aside className="respond-call-rail" aria-label="Response activity">
          <div role="tablist" aria-label="Response activity view">
            <button
              type="button"
              role="tab"
              aria-selected={rail === "active"}
              className={rail === "active" ? "active" : ""}
              onClick={() => {
                showAllRecentCalls();
                setRail("active");
              }}
            >
              Current call <b>{updatesAvailable ? 0 : "—"}</b>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rail === "recent"}
              className={rail === "recent" ? "active" : ""}
              onClick={() => {
                showAllRecentCalls();
                setRail("recent");
              }}
            >
              Recent calls <b>{recentCalls.length}</b>
            </button>
          </div>
          {rail === "active" ? (
            <div className="respond-call-rail-empty" role="tabpanel">
              <strong>{updatesAvailable ? "No active calls" : "Current call status unavailable"}</strong>
              <span>
                {updatesAvailable ? "This screen is ready. A new CAD call will open automatically." : "Updates are interrupted. Previously loaded records remain available below."}
              </span>
              <div>
                <button type="button" onClick={() => setRail("recent")}>
                  Review recent calls
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onNavigate?.("Daily Log")}
                >
                  Enter manual call in Daily Log
                </button>
              </div>
            </div>
          ) : recentCalls.length ? (
            <div className="respond-call-rail-list" role="tabpanel">
              {selectedCallCluster ? (
                <div className="respond-call-map-selection" aria-live="polite">
                  <strong>
                    {selectedCallCluster.calls.length === 1
                      ? selectedCallCluster.calls[0].address || "Saved call location"
                      : `${selectedCallCluster.calls.length} calls at this location`}
                  </strong>
                  <button
                    type="button"
                    onClick={showAllRecentCalls}
                  >
                    Show all calls
                  </button>
                </div>
              ) : null}
              {displayedRecentCalls.map((recent) => {
                const recentCluster = callClusters.find((cluster) =>
                  cluster.calls.includes(recent),
                );
                return (
                  <article
                    key={`${recent.reportNumber}-${recent.logDate}-${recent.timeOut}-${recent.address}`}
                    className={
                      selectedCallCluster?.calls.includes(recent)
                        ? "map-selected"
                        : ""
                    }
                  >
                    <button
                      type="button"
                      className="respond-call-card"
                      disabled={!recentCluster}
                      aria-label={
                        recentCluster
                          ? `Show ${recent.callType || "recent call"} at ${recent.address || "saved location"} on map`
                          : undefined
                      }
                      onClick={() =>
                        recentCluster && selectCallCluster(recentCluster)
                      }
                    >
                      <time>{recent.logDate}</time>
                      <strong>{recent.callType || "Call type not entered"}</strong>
                      <span>{recent.address || "Address not entered"}</span>
                      <small>
                        {recent.respondingUnits || "Units not entered"} ·{" "}
                        {formatRespondMilitaryTime(recent.timeOut)}
                      </small>
                      <small className="respond-call-location-source">
                        {recentCluster
                          ? `● ${recent.locationSource || "Saved call location"} · Show on map`
                          : "Location not mapped"}
                      </small>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="respond-call-rail-empty" role="tabpanel">
              <strong>No recent closed calls</strong>
              <span>Completed Daily Log calls will appear here.</span>
            </div>
          )}
          <footer>
            <span>APPARATUS LOCATION</span>
            <strong>GPS not connected</strong>
            <small>No vehicle location is guessed.</small>
          </footer>
        </aside>
      </div>
    </section>
  );
}

export { statusLabel as respondApparatusStatusLabel };
