export type MapPoint = { lat: number; lng: number };
export type MapSize = { width: number; height: number };
type HydrantLocation = { id: string; latitude: number; longitude: number; serviceStatus: string };

export function mapWorldPoint(point: MapPoint, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.lat));
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: ((1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2) * scale,
  };
}

export function projectMapPoint(point: MapPoint, center: MapPoint, zoom: number, size: MapSize) {
  const projected = mapWorldPoint(point, zoom);
  const origin = mapWorldPoint(center, zoom);
  return { x: size.width / 2 + projected.x - origin.x, y: size.height / 2 + projected.y - origin.y };
}

export function hasMapLocation(point: { latitude: number; longitude: number }) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

/** Display-only grouping in map pixels. Original records and coordinates are never changed. */
export function clusterHydrantLocations<T extends HydrantLocation>(hydrants: T[], zoom: number) {
  const radius = zoom < 17 ? 48 : zoom < 19 ? 36 : 28;
  const groups: Array<{ anchor: { x: number; y: number }; items: T[] }> = [];
  for (const hydrant of [...hydrants].filter(hasMapLocation).sort((a, b) => a.id.localeCompare(b.id))) {
    const point = mapWorldPoint({ lat: hydrant.latitude, lng: hydrant.longitude }, zoom);
    // A fixed anchor prevents a chain of nearby points from swallowing a whole neighborhood.
    const group = groups.find(({ anchor }) => Math.hypot(point.x - anchor.x, point.y - anchor.y) < radius);
    if (group) group.items.push(hydrant);
    else groups.push({ anchor: point, items: [hydrant] });
  }
  return groups.map(({ items }) => ({
    id: items.map(item => item.id).join("|"),
    hydrants: items,
    // Keep the badge at its real anchor so neighboring groups cannot drift into each other.
    latitude: items[0].latitude,
    longitude: items[0].longitude,
    outOfService: items.filter(item => item.serviceStatus === "out_of_service").length,
    needsAttention: items.filter(item => item.serviceStatus !== "in_service").length,
  }));
}
