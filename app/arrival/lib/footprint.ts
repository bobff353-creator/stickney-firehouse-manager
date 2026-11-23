import { z } from "zod";
export type Coordinate = [number, number];
export const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-85).max(85),
]);
export const footprintSchema = z
  .object({
    rings: z.array(z.array(coordinateSchema).min(3).max(400)).min(1).max(12),
    source: z.enum(["traced", "cook-county-2022", "source-import"]),
    sourceId: z.string().max(100).nullable(),
    sourceYear: z.string().max(10),
    checkedAt: z.string().datetime().nullable(),
    checked: z.boolean(),
    sourceAreaSqFt: z.number().finite().positive().max(100000000).nullable(),
  })
  .superRefine((value, ctx) => {
    if(value.source !== 'source-import' && (!value.checked || !value.checkedAt)) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Confirm the outline before using it.'});
    const issue = footprintIssue(value.rings);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
  });
export type Footprint = z.infer<typeof footprintSchema>;
const R = 6371008.8;
const MERCATOR_R = 6378137;
const RAD = Math.PI / 180;
const SQFT = 10.763910416709722;
export function project([lng, lat]: Coordinate): Coordinate {
  return [
    MERCATOR_R * lng * RAD,
    MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
  ];
}
export function unproject([x, y]: Coordinate): Coordinate {
  return [
    x / MERCATOR_R / RAD,
    (2 * Math.atan(Math.exp(y / MERCATOR_R)) - Math.PI / 2) / RAD,
  ];
}
function ringArea(r: Coordinate[]) {
  let sum = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[(i + r.length - 1) % r.length],
      b = r[i],
      c = r[(i + 1) % r.length];
    sum += (c[0] - a[0]) * RAD * Math.sin(b[1] * RAD);
  }
  return Math.abs((sum * R * R) / 2);
}
export function distanceMeters(a: Coordinate, b: Coordinate) {
  const p1 = a[1] * RAD,
    p2 = b[1] * RAD;
  const h =
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(((b[0] - a[0]) * RAD) / 2) ** 2;
  return (
    2 * R * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function footprintMetrics(rings: Coordinate[][]) {
  const areaM2 = Math.max(
    0,
    (rings[0] ? ringArea(rings[0]) : 0) -
      rings.slice(1).reduce((s, r) => s + ringArea(r), 0),
  );
  const outside = rings[0] || [];
  const perimeterM = outside.reduce(
    (s, p, i) => s + distanceMeters(p, outside[(i + 1) % outside.length]),
    0,
  );
  return { areaM2, areaSqFt: areaM2 * SQFT, perimeterFt: perimeterM / 0.3048 };
}
function orientation(a: Coordinate, b: Coordinate, c: Coordinate) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a: Coordinate, b: Coordinate, p: Coordinate) {
  return (
    Math.abs(orientation(a, b, p)) < 1e-14 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-12 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-12 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}
function crossing(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const o1 = orientation(a, b, c),
    o2 = orientation(a, b, d),
    o3 = orientation(c, d, a),
    o4 = orientation(c, d, b);
  return (
    (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
      ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function pointInRing(point: Coordinate, ring: Coordinate[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function footprintIssue(rings: Coordinate[][]): string | null {
  if (!rings.length || rings[0].length < 3)
    return "Tap at least three outside corners.";
  if (rings.flat().length > 1000)
    return "This outline has too many corners. Simplify it before saving.";
  const points = rings.flat();
  if (
    points.some(
      (p) =>
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 85,
    )
  )
    return "The outline has invalid coordinates.";
  const lng = points.map((p) => p[0]),
    lat = points.map((p) => p[1]);
  if (
    Math.max(...lng) - Math.min(...lng) > 0.05 ||
    Math.max(...lat) - Math.min(...lat) > 0.05
  )
    return "The outline is too large for one building. Capture buildings separately.";
  for (const ring of rings) {
    if (
      ring.length < 3 ||
      new Set(ring.map((p) => p.join(","))).size !== ring.length
    )
      return "Remove repeated corners or zero-length edges.";
    for (let i = 0; i < ring.length; i++) {
      if (distanceMeters(ring[i], ring[(i + 1) % ring.length]) < 0.05)
        return "Two corners are too close together.";
      for (let j = i + 1; j < ring.length; j++) {
        if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
        if (
          crossing(
            ring[i],
            ring[(i + 1) % ring.length],
            ring[j],
            ring[(j + 1) % ring.length],
          )
        )
          return "The outline crosses itself. Move or remove the crossing corners.";
      }
    }
  }
  for (let r = 1; r < rings.length; r++) {
    if (!rings[r].every((p) => pointInRing(p, rings[0])))
      return "A courtyard must stay inside the outside outline.";
    for (let q = 0; q < r; q++) {
      if (
        q > 0 &&
        (pointInRing(rings[r][0], rings[q]) ||
          pointInRing(rings[q][0], rings[r]))
      )
        return "Courtyard outlines overlap.";
      for (let i = 0; i < rings[r].length; i++)
        for (let j = 0; j < rings[q].length; j++)
          if (
            crossing(
              rings[r][i],
              rings[r][(i + 1) % rings[r].length],
              rings[q][j],
              rings[q][(j + 1) % rings[q].length],
            )
          )
            return "Outline boundaries overlap or touch.";
    }
  }
  const a = footprintMetrics(rings).areaSqFt;
  if (a < 10)
    return "The footprint is too small. Check the corners and map scale.";
  if (a > 50000000) return "The outline is too large for one building.";
  return null;
}
export function mapBounds(lng: number, lat: number, span: number) {
  const c = project([lng, lat]);
  return [
    c[0] - span / 2,
    c[1] - span * 0.35,
    c[0] + span / 2,
    c[1] + span * 0.35,
  ] as const;
}
export function inCookCounty(lng: number, lat: number) {
  return lng >= -88.3 && lng <= -87.48 && lat >= 41.43 && lat <= 42.19;
}
export type FootprintCandidate = {
  id: string;
  rings: Coordinate[][];
  sourceAreaSqFt: number | null;
  year: string;
};
