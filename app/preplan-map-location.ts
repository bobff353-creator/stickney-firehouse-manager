type MapPoint = { lat: number; lng: number };
type MapLocation = { lat: unknown; lng: unknown } | null | undefined;

// A town-wide starting view, not a verified building or device location.
export const stickneyMapOverview = {
  center: { lat: 41.8189, lng: -87.7734 },
  zoom: 14,
};

export function preplanLocationView(location?: MapLocation, locatedZoom = 20) {
  const lat = location?.lat, lng = location?.lng;
  const located = typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 85 && Math.abs(lng) <= 180
    && (lat !== 0 || lng !== 0);
  return {
    center: located ? { lat, lng } as MapPoint : { ...stickneyMapOverview.center },
    zoom: located ? locatedZoom : stickneyMapOverview.zoom,
    located,
  };
}
