"use client";

import { useEffect, useMemo, useState } from "react";
import GoogleFieldMap from "./google-field-map";
import { formatRespondMilitaryTime } from "./respond-time";

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
};

const stickneyCenter: Point = { lat: 41.8189, lng: -87.7734 };
const canvas = { width: 1600, height: 900 };

function world(point: Point, zoom: number) {
  const scale = 256 * 2 ** zoom;
  return {
    x: ((point.lng + 180) / 360) * scale,
    y:
      ((1 -
        Math.asinh(Math.tan((point.lat * Math.PI) / 180)) / Math.PI) /
        2) *
      scale,
  };
}

function project(point: Point, center: Point, zoom: number) {
  const projected = world(point, zoom);
  const projectedCenter = world(center, zoom);
  return {
    x: canvas.width / 2 + projected.x - projectedCenter.x,
    y: canvas.height / 2 + projected.y - projectedCenter.y,
  };
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
}: {
  overview: RespondOverview;
  recentCalls: RecentCall[];
  onNavigate?: (page: "Daily Log" | "Field Preplans" | "Box Cards") => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [imagery, setImagery] = useState<"aerial" | "street">("aerial");
  const [center, setCenter] = useState(stickneyCenter);
  const [zoom, setZoom] = useState(16);
  const [rail, setRail] = useState<"active" | "recent">("active");
  const [layers, setLayers] = useState({
    preplans: true,
    hydrants: true,
    closures: true,
  });

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
      overview.preplans
        .map((plan) => ({
          plan,
          point: project(
            { lat: plan.latitude, lng: plan.longitude },
            center,
            zoom,
          ),
        }))
        .filter(
          ({ point }) =>
            point.x >= -50 &&
            point.x <= canvas.width + 50 &&
            point.y >= -50 &&
            point.y <= canvas.height + 50,
        ),
    [center, overview.preplans, zoom],
  );
  const hydrantMarkers = useMemo(
    () =>
      overview.hydrants
        .map((hydrant) => ({
          hydrant,
          point: project(
            { lat: hydrant.latitude, lng: hydrant.longitude },
            center,
            zoom,
          ),
        }))
        .filter(
          ({ point }) =>
            point.x >= -50 &&
            point.x <= canvas.width + 50 &&
            point.y >= -50 &&
            point.y <= canvas.height + 50,
        ),
    [center, overview.hydrants, zoom],
  );
  const closureLines = useMemo(
    () =>
      overview.roadClosures.map((closure) => ({
        closure,
        points: closure.path
          .map((point) => {
            const item = project(point, center, zoom);
            return `${item.x},${item.y}`;
          })
          .join(" "),
      })),
    [center, overview.roadClosures, zoom],
  );

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <section className="respond-map-shell" aria-label="Stickney response map">
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
        <button type="button" className="active" aria-pressed="true" disabled>
          <i className="call" /> Calls <b>0</b>
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

      <div className="respond-map-layout">
        <div className="respond-overview-map">
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
            viewBox={`0 0 ${canvas.width} ${canvas.height}`}
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
          {layers.preplans
            ? preplanMarkers.map(({ plan, point }) => (
                <button
                  type="button"
                  key={plan.id}
                  className="respond-map-marker preplan"
                  style={{
                    left: `${(point.x / canvas.width) * 100}%`,
                    top: `${(point.y / canvas.height) * 100}%`,
                  }}
                  aria-label={`Open preplan for ${plan.businessName || plan.address}`}
                  title={`${plan.businessName || "Preplan"} · ${plan.address}`}
                  onClick={() => onNavigate?.("Field Preplans")}
                >
                  P
                </button>
              ))
            : null}
          {layers.hydrants
            ? hydrantMarkers.map(({ hydrant, point }) => (
                <button
                  type="button"
                  key={hydrant.id}
                  className={`respond-map-marker hydrant ${hydrant.serviceStatus}`}
                  style={{
                    left: `${(point.x / canvas.width) * 100}%`,
                    top: `${(point.y / canvas.height) * 100}%`,
                  }}
                  aria-label={`Open hydrant ${hydrant.hydrantNumber || hydrant.address}`}
                  title={`${hydrant.hydrantNumber || "Hydrant"} · ${hydrant.address || "Address not entered"}`}
                  onClick={() => onNavigate?.("Field Preplans")}
                >
                  H
                </button>
              ))
            : null}
        </div>

        <aside className="respond-call-rail" aria-label="Response activity">
          <div role="tablist" aria-label="Response activity view">
            <button
              type="button"
              role="tab"
              aria-selected={rail === "active"}
              className={rail === "active" ? "active" : ""}
              onClick={() => setRail("active")}
            >
              Active <b>0</b>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rail === "recent"}
              className={rail === "recent" ? "active" : ""}
              onClick={() => setRail("recent")}
            >
              Recent <b>{recentCalls.length}</b>
            </button>
          </div>
          {rail === "active" ? (
            <div className="respond-call-rail-empty" role="tabpanel">
              <strong>No active calls</strong>
              <span>
                New CAD and dispatched Daily Log calls will appear here
                automatically.
              </span>
              <button type="button" onClick={() => onNavigate?.("Daily Log")}>
                Start incident
              </button>
            </div>
          ) : recentCalls.length ? (
            <div className="respond-call-rail-list" role="tabpanel">
              {recentCalls.map((recent) => (
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
