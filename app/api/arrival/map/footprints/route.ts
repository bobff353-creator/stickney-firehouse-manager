import { handle, identity, json, HttpError } from "@/app/arrival/lib/server";
import { mapRequest } from "@/app/arrival/lib/map-server";
import {
  mapBounds,
  unproject,
  footprintIssue,
  type Coordinate,
  type FootprintCandidate,
} from "@/app/arrival/lib/footprint";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await identity(request);
    const { lng, lat, span } = mapRequest(request);
    const bbox = mapBounds(lng, lat, span);
    const lo = unproject([bbox[0], bbox[1]]),
      hi = unproject([bbox[2], bbox[3]]);
    const url = new URL(
      "https://gis.cookcountyil.gov/traditional/rest/services/buildingFootprint_2022/MapServer/0/query",
    );
    url.search = new URLSearchParams({
      where: "1=1",
      geometry: [lo[0], lo[1], hi[0], hi[1]].join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "OBJECTID,Area_SQFT,Year",
      returnGeometry: "true",
      resultRecordCount: "81",
      f: "geojson",
    }).toString();
    let data: {
      features?: {
        id?: number;
        properties?: Record<string, unknown>;
        geometry?: { type: string; coordinates: unknown };
      }[];
      exceededTransferLimit?: boolean;
      error?: unknown;
    };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error();
      data = await r.json();
      if (data.error || !Array.isArray(data.features)) throw new Error();
    } catch {
      throw new HttpError(
        503,
        "County footprint lookup is unavailable. You can still trace an outline on the aerial.",
      );
    }
    const candidates: FootprintCandidate[] = [];
    let skipped = 0;
    for (const f of data.features!.slice(0, 80)) {
      const g = f.geometry;
      if (!g || !["Polygon", "MultiPolygon"].includes(g.type)) {
        skipped++;
        continue;
      }
      const polygons = (
        g.type === "Polygon" ? [g.coordinates] : g.coordinates
      ) as Coordinate[][][];
      for (const [part, raw] of polygons.entries()) {
        const rings = raw.map((r) => {
          const a = r.map((p) => [p[0], p[1]] as Coordinate);
          if (
            a.length > 1 &&
            a[0][0] === a.at(-1)![0] &&
            a[0][1] === a.at(-1)![1]
          )
            a.pop();
          return a;
        });
        if (
          rings.some((r) => r.length > 400) ||
          rings.length > 12 ||
          footprintIssue(rings)
        ) {
          skipped++;
          continue;
        }
        candidates.push({
          id: String(f.properties?.OBJECTID ?? f.id ?? "unknown") + "-" + part,
          rings,
          sourceAreaSqFt:
            polygons.length === 1 && typeof f.properties?.Area_SQFT === "number"
              ? f.properties.Area_SQFT
              : null,
          year: String(f.properties?.Year || "2022"),
        });
        if (candidates.length >= 80) break;
      }
      if (candidates.length >= 80) break;
    }
    return json({
      candidates,
      limited:
        !!data.exceededTransferLimit ||
        data.features!.length > 80 ||
        candidates.length >= 80,
      skipped,
      source:
        "Cook County GIS · 2022 imagery/LiDAR footprints (published in 2025)",
    });
  });
}
