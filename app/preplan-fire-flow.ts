export type Point = { lat: number; lng: number };
export type ConstructionGroup =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "V"
  | "V_LIGHTWEIGHT"
  | "IA_IB"
  | "IIA_IIIA"
  | "IV_VA"
  | "IIB_IIIB"
  | "VB";
export type OccupancyFlowCategory = "other" | "dwelling";
export type SprinklerStandard = "none" | "nfpa13" | "nfpa13r" | "residential";

export const constructionOptions: Array<{
  value: ConstructionGroup;
  label: string;
}> = [
  { value: "I", label: "Type I" },
  { value: "II", label: "Type II" },
  { value: "III", label: "Type III" },
  { value: "IV", label: "Type IV" },
  { value: "V", label: "Type V" },
  { value: "V_LIGHTWEIGHT", label: "Type V Lightweight" },
];

const table = [
  { gpm: 1500, duration: 2, max: [22700, 12700, 8200, 5900, 3600] },
  { gpm: 1750, duration: 2, max: [30200, 17000, 10900, 7900, 4800] },
  { gpm: 2000, duration: 2, max: [38700, 21800, 12900, 9800, 6200] },
  { gpm: 2250, duration: 2, max: [48300, 24200, 17400, 12600, 7700] },
  { gpm: 2500, duration: 2, max: [59000, 33200, 21300, 15400, 9400] },
  { gpm: 2750, duration: 2, max: [70900, 39700, 25500, 18400, 11300] },
  { gpm: 3000, duration: 3, max: [83700, 47100, 30100, 21800, 13400] },
  { gpm: 3250, duration: 3, max: [97700, 54900, 35200, 25900, 15600] },
  { gpm: 3500, duration: 3, max: [112700, 63400, 40600, 29300, 18000] },
  { gpm: 3750, duration: 3, max: [128700, 72400, 46400, 33500, 20600] },
  { gpm: 4000, duration: 4, max: [145900, 82100, 52500, 37900, 23300] },
  { gpm: 4250, duration: 4, max: [164200, 92400, 59100, 42700, 26300] },
  { gpm: 4500, duration: 4, max: [183400, 103100, 66000, 47700, 29300] },
  { gpm: 4750, duration: 4, max: [203700, 114600, 73300, 53000, 32600] },
  { gpm: 5000, duration: 4, max: [225200, 126700, 81100, 58600, 36000] },
  { gpm: 5250, duration: 4, max: [247700, 139400, 89200, 65400, 39600] },
  { gpm: 5500, duration: 4, max: [271200, 152600, 97700, 70600, 43400] },
  { gpm: 5750, duration: 4, max: [295900, 166500, 106500, 77000, 47400] },
  {
    gpm: 6000,
    duration: 4,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      115800,
      83700,
      51500,
    ],
  },
  {
    gpm: 6250,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      125500,
      90600,
      55700,
    ],
  },
  {
    gpm: 6500,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      135500,
      97900,
      60200,
    ],
  },
  {
    gpm: 6750,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      145800,
      106800,
      64800,
    ],
  },
  {
    gpm: 7000,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      156700,
      113200,
      69600,
    ],
  },
  {
    gpm: 7250,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      167900,
      121300,
      74600,
    ],
  },
  {
    gpm: 7500,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      179400,
      129600,
      79800,
    ],
  },
  {
    gpm: 7750,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      191400,
      138300,
      85100,
    ],
  },
  {
    gpm: 8000,
    duration: 5,
    max: [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ],
  },
] as const;

function constructionIndex(value: ConstructionGroup) {
  return ({ I:0,II:1,III:3,IV:2,V:4,V_LIGHTWEIGHT:4,IA_IB:0,IIA_IIIA:1,IV_VA:2,IIB_IIIB:3,VB:4 } as const)[value];
}
export function polygonAreaSquareFeet(points: Point[]) {
  if (points.length < 3) return 0;
  const earthRadiusMeters = 6378137;
  const meanLatitude =
    ((points.reduce((sum, point) => sum + point.lat, 0) / points.length) *
      Math.PI) /
    180;
  const projected = points.map((point) => ({
    x:
      ((earthRadiusMeters * point.lng * Math.PI) / 180) *
      Math.cos(meanLatitude),
    y: (earthRadiusMeters * point.lat * Math.PI) / 180,
  }));
  const twiceArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return (Math.abs(twiceArea) / 2) * 10.7639104167;
}

export function footprintCentroid(points: Point[]) {
  if (!points.length) return null;
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

export function detailedPreplanMapView(
  points: Point[],
  fallbackCenter: Point,
) {
  const validPoints = points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  if (!validPoints.length) return { center: fallbackCenter, zoom: 20 };

  const latitudes = validPoints.map((point) => point.lat);
  const longitudes = validPoints.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
  if (validPoints.length < 2) return { center, zoom: 20 };

  const mercatorY = (latitude: number) => {
    const limited = Math.max(-85, Math.min(85, latitude));
    const radians = (limited * Math.PI) / 180;
    return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
  };
  const longitudeSpan = Math.max((maxLng - minLng) / 360, Number.EPSILON);
  const latitudeSpan = Math.max(
    Math.abs(mercatorY(maxLat) - mercatorY(minLat)),
    Number.EPSILON,
  );
  const usableWidth = 900 - 2 * 96;
  const usableHeight = 420 - 2 * 72;
  const scale = Math.min(
    usableWidth / (256 * longitudeSpan),
    usableHeight / (256 * latitudeSpan),
  );
  const zoom = Math.max(18, Math.min(21, Math.floor(Math.log2(scale))));
  return { center, zoom };
}

export function fireFlowCalculationArea(
  footprintSquareFeet: number,
  floorCount: number,
  constructionType: ConstructionGroup,
) {
  const levels =
    constructionType === "I" || constructionType === "IA_IB"
      ? Math.min(3, Math.max(1, Math.trunc(floorCount)))
      : Math.max(1, Math.trunc(floorCount));
  return Math.round(Math.max(0, footprintSquareFeet) * levels);
}

export function suggestedFireFlow(input: {
  footprintSquareFeet: number;
  floorCount: number;
  constructionType: ConstructionGroup;
  occupancyFlowCategory: OccupancyFlowCategory;
  sprinklerStandard: SprinklerStandard;
}) {
  const calculationArea = fireFlowCalculationArea(
    input.footprintSquareFeet,
    input.floorCount,
    input.constructionType,
  );
  if (!calculationArea) return null;

  if (input.occupancyFlowCategory === "dwelling" && calculationArea <= 3600) {
    const sprinkler = input.sprinklerStandard === "residential";
    return {
      calculationArea,
      baseGpm: 1000,
      suggestedGpm: sprinkler ? 500 : 1000,
      durationHours: sprinkler ? 0.5 : 1,
      reduction: sprinkler
        ? "Residential sprinkler reduction"
        : "No sprinkler reduction",
    };
  }

  const row =
    table.find(
      (item) =>
        calculationArea <= item.max[constructionIndex(input.constructionType)],
    ) ?? table.at(-1)!;
  let suggestedGpm: number = row.gpm;
  let reduction = "No sprinkler reduction";
  let durationHours: number = row.duration;

  if (
    input.occupancyFlowCategory === "dwelling" &&
    input.sprinklerStandard === "residential"
  ) {
    suggestedGpm = Math.ceil(row.gpm * 0.5);
    durationHours = 1;
    reduction = "Residential sprinkler reduction";
  } else if (
    input.occupancyFlowCategory === "other" &&
    input.sprinklerStandard === "nfpa13"
  ) {
    suggestedGpm = Math.max(1000, Math.ceil(row.gpm * 0.25));
    reduction = "NFPA 13 reduction, 1,000 GPM minimum";
  } else if (
    input.occupancyFlowCategory === "other" &&
    input.sprinklerStandard === "nfpa13r"
  ) {
    suggestedGpm = Math.max(1500, Math.ceil(row.gpm * 0.25));
    reduction = "NFPA 13R reduction, 1,500 GPM minimum";
  }

  return {
    calculationArea,
    baseGpm: row.gpm,
    suggestedGpm,
    durationHours,
    reduction,
  };
}
