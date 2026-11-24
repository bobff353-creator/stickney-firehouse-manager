"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  MapPin,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  RefreshCw,
  Undo2,
} from "lucide-react";
import {
  type Footprint,
  type Coordinate,
  type FootprintCandidate,
  footprintIssue,
  footprintMetrics,
  project,
  unproject,
  mapBounds,
  inCookCounty,
} from "../lib/footprint";
import { request } from "../lib/client";
import { Field, Pill } from "./ui";
type View = { lng: number; lat: number; span: number };
function initialView(
  value: Footprint | undefined,
  lat: string,
  lng: string,
): View | null {
  if (value?.rings[0]?.length) {
    const points = value.rings.flat().map(project);
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2,
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const c = unproject([x, y]);
    return {
      lng: c[0],
      lat: c[1],
      span: Math.min(5000, Math.max(
        100,
        (Math.max(...xs) - Math.min(...xs)) * 1.7,
        (Math.max(...ys) - Math.min(...ys)) * 2.4,
      )),
    };
  }
  return lat && lng && inCookCounty(Number(lng), Number(lat))
    ? { lat: Number(lat), lng: Number(lng), span: 180 }
    : null;
}
function svgPath(rings: Coordinate[][], view: View) {
  const b = mapBounds(view.lng, view.lat, view.span);
  return rings
    .map(
      (r) =>
        r
          .map((point, i) => {
            const p = project(point);
            return `${i ? "L" : "M"}${((p[0] - b[0]) / view.span) * 1000},${((b[3] - p[1]) / (view.span * 0.7)) * 700}`;
          })
          .join(" ") + " Z",
    )
    .join(" ");
}
export default function FootprintCapture({
  value,
  address,
  latitude,
  longitude,
  onChange,
  onPendingChange,
}: {
  value: Footprint | undefined;
  address: string;
  latitude: string;
  longitude: string;
  onChange: (v: Footprint | undefined) => void;
  onPendingChange: (v: boolean) => void;
}) {
  const [search, setSearch] = useState(address);
  const [matches, setMatches] = useState<
    { address: string; lat: number; lng: number }[]
  >([]);
  const [view, setView] = useState<View | null>(() =>
    initialView(value, latitude, longitude),
  );
  const [lat, setLat] = useState(latitude);
  const [lng, setLng] = useState(longitude);
  const [mode, setMode] = useState<"select" | "trace" | "edit">("select");
  const [rings, setRings] = useState<Coordinate[][]>(() =>
    value?.rings ? structuredClone(value.rings) : [],
  );
  const [source, setSource] = useState<Footprint["source"]>(
    value?.source || "traced",
  );
  const [sourceId, setSourceId] = useState<string | null>(
    value?.sourceId || null,
  );
  const [reportedArea, setReportedArea] = useState<number | null>(
    value?.sourceAreaSqFt || null,
  );
  const [checked, setChecked] = useState(false);
  const [candidates, setCandidates] = useState<FootprintCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [limited, setLimited] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [ringIndex, setRingIndex] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ ring: number; point: number } | null>(null);
  useEffect(() => {
    if (!view || !inCookCounty(view.lng, view.lat)) return;
    setImageLoaded(false);
    setImageError(false);
    setLookupBusy(true);
    setLookupError("");
    const abort = new AbortController();
    request<{
      candidates: FootprintCandidate[];
      limited: boolean;
      skipped: number;
    }>(
      "/api/arrival/map/footprints?" +
        new URLSearchParams({
          lng: String(view.lng),
          lat: String(view.lat),
          span: String(view.span),
        }),
      { signal: abort.signal },
    )
      .then((r) => {
        setCandidates(r.candidates);
        setLimited(r.limited);
        if (r.skipped)
          setLookupError(
            `${r.skipped} complex or invalid GIS shapes were omitted. Trace manually if your building is missing.`,
          );
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setCandidates([]);
          setLookupError((e as Error).message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLookupBusy(false);
      });
    return () => abort.abort();
  }, [view]);
  useEffect(() => {
    onPendingChange(
      JSON.stringify(rings) !== JSON.stringify(value?.rings || []),
    );
  }, [rings, value, onPendingChange]);
  const [retry, setRetry] = useState(0);
  const issue = rings.length
    ? footprintIssue(rings)
    : "Select a GIS outline, or trace at least three outside corners.";
  const metrics = footprintMetrics(rings);
  const mapQuery = view
    ? new URLSearchParams({
        lng: String(view.lng),
        lat: String(view.lat),
        span: String(view.span),
        retry: String(retry),
      }).toString()
    : "";
  async function find() {
    setBusy(true);
    setError("");
    setMatches([]);
    try {
      const r = await request<{
        matches: { address: string; lat: number; lng: number }[];
      }>("/api/arrival/map/geocode?address=" + encodeURIComponent(search));
      setMatches(r.matches);
      if (!r.matches.length)
        setError(
          "No address match. Check the city and state, or enter verified coordinates.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function locate(lat: number, lng: number) {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !inCookCounty(lng, lat)
    ) {
      setError(
        "The pilot aerial and GIS footprint service covers Cook County, Illinois. This location is outside that coverage.",
      );
      return;
    }
    setView({ lat, lng, span: 180 });
    setLat(String(lat));
    setLng(String(lng));
    setError("");
    setChecked(false);
  }
  function pan(dx: number, dy: number) {
    if (!view) return;
    const p = project([view.lng, view.lat]);
    const c = unproject([p[0] + view.span * dx, p[1] + view.span * 0.7 * dy]);
    if (!inCookCounty(c[0], c[1])) {
      setError("That would move outside the county coverage.");
      return;
    }
    setView({ ...view, lng: c[0], lat: c[1] });
  }
  function choose(candidate: FootprintCandidate) {
    setRings(structuredClone(candidate.rings));
    setSource("cook-county-2022");
    setSourceId(candidate.id);
    setReportedArea(candidate.sourceAreaSqFt);
    setRingIndex(0);
    setChecked(false);
    setMode("select");
    setError("");
  }
  function toPoint(clientX: number, clientY: number): Coordinate | null {
    if (!view || !svg.current) return null;
    const rect = svg.current.getBoundingClientRect();
    const b = mapBounds(view.lng, view.lat, view.span);
    return unproject([
      b[0] +
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) *
          view.span,
      b[3] -
        Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) *
          view.span *
          0.7,
    ]);
  }
  function editCorner(r: number, i: number, p: Coordinate) {
    setRings((old) =>
      old.map((ring, ri) =>
        ri === r ? ring.map((q, qi) => (qi === i ? p : q)) : ring,
      ),
    );
    setSource("traced");
    setReportedArea(null);
    setChecked(false);
  }
  function trace() {
    setRings([[]]);
    setRingIndex(0);
    setMode("trace");
    setSource("traced");
    setSourceId(null);
    setReportedArea(null);
    setChecked(false);
    setError("");
  }
  function courtyard() {
    setRings((old) => [...old, []]);
    setRingIndex(rings.length);
    setMode("trace");
    setSource("traced");
    setReportedArea(null);
    setChecked(false);
  }
  function accept() {
    if (issue || !checked || !imageLoaded) return;
    onChange({
      rings: structuredClone(rings),
      source: source === "source-import" ? "traced" : source,
      sourceId,
      sourceYear: source === "cook-county-2022" ? "2022" : "2025",
      sourceAreaSqFt: reportedArea,
      checked: true,
      checkedAt: new Date().toISOString(),
    });
    setError("");
  }
  return (
    <div className="footprint-capture">
      <div className="outline-intro">
        <div>
          <h3>Capture outline</h3>
          <p>Select a GIS outline or trace the outside corners.</p>
        </div>
        <Pill>Cook County imagery</Pill>
      </div>
      <div className="outline-search">
        <Field label="Find the building address">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={500}
            placeholder="Street address, city, state"
          />
        </Field>
        <button
          className="btn"
          disabled={busy || !search.trim()}
          onClick={() => void find()}
        >
          <MapPin size={17} />
          {busy ? "Finding…" : "Find address"}
        </button>
      </div>
      {matches.length > 0 && (
        <div className="address-matches">
          <p>
            Address-range matches are approximate. Choose a match, then confirm
            the actual building on the aerial.
          </p>
          {matches.map((m, i) => (
            <button type="button" key={i} onClick={() => locate(m.lat, m.lng)}>
              {m.address}
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      )}
      <details className="optional">
        <summary>
          Use verified coordinates instead<span>Optional</span>
        </summary>
        <div className="form-grid">
          <Field label="Outline map latitude">
            <input
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Field>
          <Field label="Outline map longitude">
            <input
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </Field>
        </div>
        <button
          className="btn small"
          onClick={() => {
            if (!lat.trim() || !lng.trim()) {
              setError("Enter both coordinates.");
              return;
            }
            locate(Number(lat), Number(lng));
          }}
        >
          Show location
        </button>
      </details>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {view && (
        <>
          <div className="outline-toolbar">
            <button
              className={
                "btn small " + (mode === "select" ? "active-tool" : "")
              }
              aria-pressed={mode === "select"}
              onClick={() => setMode("select")}
            >
              <MousePointer2 size={16} />
              Select GIS outline
            </button>
            <button
              className={"btn small " + (mode === "trace" ? "active-tool" : "")}
              aria-pressed={mode === "trace"}
              onClick={trace}
            >
              <PenLine size={16} />
              Trace new outline
            </button>
            <button
              className={"btn small " + (mode === "edit" ? "active-tool" : "")}
              aria-pressed={mode === "edit"}
              disabled={!rings[0]?.length}
              onClick={() => setMode("edit")}
            >
              Edit corners
            </button>
          </div>
          <div className="outline-help" role="status">
            {lookupBusy
              ? "Loading nearby GIS outlines…"
              : mode === "select"
                ? "Tap the right building outline, then check it against the aerial."
                : mode === "trace"
                  ? "Tap each corner in order. The shape closes automatically after three points."
                  : "Drag a corner, or use its keyboard / coordinate controls below."}
          </div>
          <div
            className={"geographic-map " + (mode === "trace" ? "tracing" : "")}
          >
            <svg
              ref={svg}
              viewBox="0 0 1000 700"
              aria-label="North-up aerial map with geographic building outlines"
              role="group"
              onClick={(e) => {
                if (mode !== "trace") return;
                const p = toPoint(e.clientX, e.clientY);
                if (!p) return;
                setRings((old) =>
                  old.map((r, i) => (i === ringIndex ? [...r, p] : r)),
                );
                setChecked(false);
              }}
            >
              <image
                href={"/api/arrival/map/aerial?" + mapQuery}
                width="1000"
                height="700"
                onLoad={() => {
                  setImageLoaded(true);
                  setImageError(false);
                }}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(false);
                }}
              />
              {mode === "select" &&
                candidates.map((c, i) => (
                  <path
                    key={c.id}
                    d={svgPath(c.rings, view)}
                    className="gis-candidate"
                    fillRule="evenodd"
                    role="button"
                    tabIndex={0}
                    aria-label={
                      "Select GIS outline " +
                      (i + 1) +
                      " · " +
                      Math.round(
                        footprintMetrics(c.rings).areaSqFt,
                      ).toLocaleString() +
                      " square feet"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(c);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        choose(c);
                      }
                    }}
                  />
                ))}
              {rings[0]?.length > 0 && (
                <path
                  d={svgPath(rings, view)}
                  className={"selected-footprint " + (issue ? "invalid" : "")}
                  fillRule="evenodd"
                  pointerEvents="none"
                />
              )}
              {mode === "edit" &&
                rings.flatMap((ring, ri) =>
                  ring.map((p, pi) => {
                    const b = mapBounds(view.lng, view.lat, view.span),
                      m = project(p),
                      x = ((m[0] - b[0]) / view.span) * 1000,
                      y = ((b[3] - m[1]) / (view.span * 0.7)) * 700;
                    return (
                      <circle
                        key={ri + "-" + pi}
                        cx={x}
                        cy={y}
                        r="18"
                        className="footprint-corner"
                        role="button"
                        tabIndex={0}
                        aria-label={
                          "Edit ring " + (ri + 1) + " corner " + (pi + 1)
                        }
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          dragging.current = { ring: ri, point: pi };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (
                            dragging.current?.ring !== ri ||
                            dragging.current?.point !== pi
                          )
                            return;
                          const next = toPoint(e.clientX, e.clientY);
                          if (next) editCorner(ri, pi, next);
                        }}
                        onPointerUp={() => {
                          dragging.current = null;
                        }}
                        onPointerCancel={() => {
                          dragging.current = null;
                        }}
                        onKeyDown={(e) => {
                          const n = e.shiftKey ? 10 : 2;
                          const dx =
                              e.key === "ArrowLeft"
                                ? -n
                                : e.key === "ArrowRight"
                                  ? n
                                  : 0,
                            dy =
                              e.key === "ArrowUp"
                                ? -n
                                : e.key === "ArrowDown"
                                  ? n
                                  : 0;
                          if (dx || dy) {
                            e.preventDefault();
                            editCorner(
                              ri,
                              pi,
                              unproject([
                                m[0] + (dx / 1000) * view.span,
                                m[1] + (dy / 700) * view.span * 0.7,
                              ]),
                            );
                          }
                        }}
                      />
                    );
                  }),
                )}
            </svg>
            {!imageLoaded && (
              <div className="map-image-status">
                {imageError
                  ? "Aerial unavailable. Your saved outline is unchanged; retry or return later."
                  : "Loading 2025 county aerial…"}
              </div>
            )}
            <div className="map-zoom">
              <button
                className="icon-button"
                aria-label="Zoom aerial in"
                onClick={() =>
                  setView({ ...view, span: Math.max(40, view.span / 1.5) })
                }
                disabled={view.span <= 40}
              >
                <Plus size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Zoom aerial out"
                onClick={() =>
                  setView({ ...view, span: Math.min(5000, view.span * 1.5) })
                }
                disabled={view.span >= 5000}
              >
                <Minus size={19} />
              </button>
            </div>
            <span className="north-label">N ↑</span>
            <span className="map-attribution">
              Cook County GIS · 2025 aerial · 2022 footprints
            </span>
          </div>
          <div className="map-pan">
            <span>Move map</span>
            <button
              className="btn small"
              aria-label="Move aerial west"
              onClick={() => pan(-0.35, 0)}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              className="btn small"
              aria-label="Move aerial north"
              onClick={() => pan(0, 0.35)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="btn small"
              aria-label="Move aerial south"
              onClick={() => pan(0, -0.35)}
            >
              <ArrowDown size={16} />
            </button>
            <button
              className="btn small"
              aria-label="Move aerial east"
              onClick={() => pan(0.35, 0)}
            >
              <ArrowRight size={16} />
            </button>
            {imageError && (
              <button
                className="btn small"
                onClick={() => {
                  setImageError(false);
                  setRetry((v) => v + 1);
                }}
              >
                <RefreshCw size={15} />
                Retry aerial
              </button>
            )}
          </div>
          {lookupError && <p className="field-help">{lookupError}</p>}
          {limited && (
            <p className="field-help">
              Up to 80 outlines shown. Zoom in to narrow the search.
            </p>
          )}
          {mode === "select" && candidates.length > 0 && (
            <details className="optional">
              <summary>
                Select an outline from a list<span>Keyboard option</span>
              </summary>
              <Field label="Available GIS outlines">
                <select
                  value=""
                  onChange={(e) => {
                    const c = candidates.find((c) => c.id === e.target.value);
                    if (c) choose(c);
                  }}
                >
                  <option value="">Choose the matching building outline</option>
                  {candidates.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      Outline {i + 1} ·{" "}
                      {Math.round(
                        footprintMetrics(c.rings).areaSqFt,
                      ).toLocaleString()}{" "}
                      sq ft · GIS {c.id}
                    </option>
                  ))}
                </select>
              </Field>
            </details>
          )}
          <div className="outline-metrics">
            <div>
              <small>Estimated ground footprint</small>
              <strong>
                {rings[0]?.length >= 3
                  ? Math.round(metrics.areaSqFt).toLocaleString()
                  : "—"}
                <span> sq ft</span>
              </strong>
            </div>
            <div>
              <small>Outer perimeter</small>
              <strong>
                {rings[0]?.length >= 3
                  ? Math.round(metrics.perimeterFt).toLocaleString()
                  : "—"}
                <span> ft</span>
              </strong>
            </div>
            <div>
              <small>Geometry</small>
              <strong>
                {rings.reduce((n, r) => n + r.length, 0)}
                <span> corners</span>
              </strong>
            </div>
          </div>
          <p className="field-help">
            {source === "source-import" ? "Imported source outline. Check it against the aerial and current building before accepting it." : source === "cook-county-2022"
              ? "Selected county GIS outline from 2022 imagery/LiDAR. Check it against the 2025 aerial and current site."
              : "Traced or edited from the aerial. Roof overhangs and imagery can affect the estimate."}{" "}
            Ground footprint is not total floor area, usable area, or a survey
            measurement.
            {reportedArea !== null
              ? " County-reported source area: " +
                Math.round(reportedArea).toLocaleString() +
                " sq ft. The displayed estimate is recalculated from the actual polygon."
              : ""}
          </p>
          <div className="outline-edit-actions">
            <button
              className="btn small"
              onClick={() => {
                setRings(value?.rings ? structuredClone(value.rings) : []);
                setSource(value?.source || "traced");
                setSourceId(value?.sourceId || null);
                setReportedArea(value?.sourceAreaSqFt || null);
                setChecked(false);
                setMode("select");
              }}
            >
              Discard outline changes
            </button>
            <button
              className="btn small"
              disabled={mode !== "trace" || !rings[ringIndex]?.length}
              onClick={() => {
                setRings((old) =>
                  old.map((r, i) => (i === ringIndex ? r.slice(0, -1) : r)),
                );
                setChecked(false);
              }}
            >
              <Undo2 size={15} />
              Undo last corner
            </button>
            <button
              className="btn small"
              disabled={!!issue || rings.length >= 12}
              onClick={courtyard}
            >
              Add courtyard / opening
            </button>
          </div>
          {mode === "edit" && (
            <details className="optional">
              <summary>
                Edit corner coordinates<span>Keyboard / precision</span>
              </summary>
              {rings.map((ring, ri) => (
                <div key={ri}>
                  <h3>{ri === 0 ? "Outside outline" : "Courtyard " + ri}</h3>
                  {ring.map((p, pi) => (
                    <div className="corner-input" key={pi}>
                      <span>{pi + 1}</span>
                      <Field
                        label={
                          "Ring " +
                          (ri + 1) +
                          " corner " +
                          (pi + 1) +
                          " longitude"
                        }
                      >
                        <input
                          type="number"
                          step="0.000001"
                          value={p[0]}
                          onChange={(e) =>
                            editCorner(ri, pi, [Number(e.target.value), p[1]])
                          }
                        />
                      </Field>
                      <Field
                        label={
                          "Ring " +
                          (ri + 1) +
                          " corner " +
                          (pi + 1) +
                          " latitude"
                        }
                      >
                        <input
                          type="number"
                          step="0.000001"
                          value={p[1]}
                          onChange={(e) =>
                            editCorner(ri, pi, [p[0], Number(e.target.value)])
                          }
                        />
                      </Field>
                      <button
                        className="icon-button"
                        aria-label={
                          "Remove ring " + (ri + 1) + " corner " + (pi + 1)
                        }
                        onClick={() => {
                          setRings((old) =>
                            old.map((r, i) =>
                              i === ri ? r.filter((_, n) => n !== pi) : r,
                            ),
                          );
                          setSource("traced");
                          setReportedArea(null);
                          setChecked(false);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </details>
          )}
          {issue && (
            <p className="outline-issue" role="status">
              {issue}
            </p>
          )}
          <label className="check-card">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              <b>I checked this outline against the correct building</b>
              <small>
                Review additions, missing sections, courtyards and neighboring
                buildings. Aerials and GIS can be out of date.
              </small>
            </span>
          </label>
          <button
            className="btn primary"
            disabled={!!issue || !checked || !imageLoaded}
            onClick={accept}
          >
            <Check size={17} />
            Use this outline in the working copy
          </button>
          {value && (
            <p className="field-help">
              A checked outline is already in this working copy. Choosing a
              replacement only takes effect when you use it above.
            </p>
          )}
        </>
      )}
      {value && (
        <button
          className="text-button muted"
          onClick={() => {
            onChange(undefined);
            setRings([]);
            setChecked(false);
          }}
        >
          Remove outline from working copy
        </button>
      )}
      <p className="field-help">
        Sources:{" "}
        <a
          href="https://gis.cookcountyil.gov/traditional/rest/services/buildingFootprint_2022/MapServer/0"
          target="_blank"
          rel="noreferrer"
        >
          Cook County building footprints
        </a>{" "}
        ·{" "}
        <a
          href="https://img.cookcountyil.gov/imagery/rest/services/CookOrtho2025/ImageServer"
          target="_blank"
          rel="noreferrer"
        >
          2025 county aerials
        </a>
        . Address search uses the U.S. Census geocoder. These are reference
        datasets, not live conditions.
      </p>
    </div>
  );
}
export function FootprintReadout({ value }: { value: Footprint }) {
  const m = footprintMetrics(value.rings);
  const points = value.rings.flat().map(project),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const c = unproject([
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]);
  const view = {
    lng: c[0],
    lat: c[1],
    span: Math.max(
      40,
      (Math.max(...xs) - Math.min(...xs)) * 1.3,
      (Math.max(...ys) - Math.min(...ys)) * 1.85,
    ),
  };
  return (
    <section className="panel footprint-readout">
      <div className="panel-title">
        <div>
          <h2>Geographic building outline</h2>
          <p>North up · estimated ground footprint · not total floor area</p>
        </div>
        <Pill>
          {value.source === "cook-county-2022"
            ? "County GIS"
            : value.source === "source-import" ? "Imported · check outline" : "Traced / edited"}
        </Pill>
      </div>
      <div className="saved-outline-grid">
        <svg
          viewBox="0 0 1000 700"
          role="img"
          aria-label="Saved geographic building outline, north up"
        >
          <path
            d={svgPath(value.rings, view)}
            className="saved-footprint"
            fillRule="evenodd"
          />
          <text x="930" y="60" fill="currentColor" fontSize="35">
            N ↑
          </text>
        </svg>
        <div>
          <strong>
            {Math.round(m.areaSqFt).toLocaleString()}
            <span> sq ft</span>
          </strong>
          <p>{Math.round(m.perimeterFt).toLocaleString()} ft outer perimeter</p>
          <p>{Math.round(m.areaM2).toLocaleString()} m² footprint</p>
          <small>
            Source year {value.sourceYear || "not recorded"} · {value.checkedAt ? "source check " + new Date(value.checkedAt).toLocaleDateString("en-US", {timeZone:"America/Chicago"}) : "not newly checked"}
          </small>
          <p>
            Estimate from the saved polygon. Verify current dimensions and site
            conditions.
          </p>
        </div>
      </div>
    </section>
  );
}
