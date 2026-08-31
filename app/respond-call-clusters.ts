export type ClusterableRecentCall = {
  reportNumber: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type RecentCallCluster<T extends ClusterableRecentCall> = {
  id: string;
  latitude: number;
  longitude: number;
  calls: T[];
};

function distanceFeet(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthFeet = 20_902_231;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const latitudeA = radians(first.latitude);
  const latitudeB = radians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthFeet * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function clusterRecentCallLocations<T extends ClusterableRecentCall>(
  calls: T[],
  thresholdFeet = 90,
) {
  const clusters: Array<RecentCallCluster<T>> = [];
  for (const call of calls) {
    if (
      call.latitude == null ||
      call.longitude == null ||
      !Number.isFinite(call.latitude) ||
      !Number.isFinite(call.longitude) ||
      Math.abs(call.latitude) > 90 ||
      Math.abs(call.longitude) > 180
    )
      continue;
    const point = {
      latitude: call.latitude,
      longitude: call.longitude,
    };
    const cluster = clusters.find(
      (item) => distanceFeet(item, point) <= thresholdFeet,
    );
    if (!cluster) {
      clusters.push({
        id: `${call.reportNumber || `${point.latitude.toFixed(6)}-${point.longitude.toFixed(6)}`}-${clusters.length + 1}`,
        latitude: point.latitude,
        longitude: point.longitude,
        calls: [call],
      });
      continue;
    }
    const count = cluster.calls.length;
    cluster.latitude =
      (cluster.latitude * count + point.latitude) / (count + 1);
    cluster.longitude =
      (cluster.longitude * count + point.longitude) / (count + 1);
    cluster.calls.push(call);
  }
  return clusters;
}
