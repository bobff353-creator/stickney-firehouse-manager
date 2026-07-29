const gaugeId = "lyni2";
const gaugeUrl = `https://water.noaa.gov/gauges/${gaugeId}`;
const apiUrl = `https://api.water.noaa.gov/nwps/v1/gauges/${gaugeId}`;

type GaugeMetadata = {
  name?: string;
  status?: { observed?: { primary?: number; primaryUnit?: string; floodCategory?: string; validTime?: string } };
  flood?: {
    stageUnits?: string;
    categories?: {
      action?: { stage?: number };
      minor?: { stage?: number };
      moderate?: { stage?: number };
      major?: { stage?: number };
    };
  };
  images?: { hydrograph?: { default?: string } };
  inService?: { enabled?: boolean; message?: string };
};

function usable(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > -900 ? number : null;
}

export async function GET() {
  try {
    const response = await fetch(apiUrl, {
      headers: { accept: "application/json", "user-agent": "Stickney-Fire-Operations-Board/1.0" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error(`NOAA returned ${response.status}`);
    const gauge = await response.json() as GaugeMetadata;
    const observed = gauge.status?.observed;
    const categories = gauge.flood?.categories;
    const level = usable(observed?.primary);
    if (level == null) throw new Error("NOAA did not provide a current river stage");
    return Response.json({
      gaugeId: gaugeId.toUpperCase(),
      name: gauge.name || "Des Plaines River at Lyons",
      level,
      unit: observed?.primaryUnit || gauge.flood?.stageUnits || "ft",
      category: observed?.floodCategory || "unknown",
      validTime: observed?.validTime || "",
      actionStage: usable(categories?.action?.stage),
      minorStage: usable(categories?.minor?.stage),
      moderateStage: usable(categories?.moderate?.stage),
      majorStage: usable(categories?.major?.stage),
      inService: gauge.inService?.enabled !== false,
      serviceMessage: gauge.inService?.message || "",
      sourceUrl: gaugeUrl,
      hydrographUrl: gauge.images?.hydrograph?.default || "",
      retrievedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "River gauge is temporarily unavailable", sourceUrl: gaugeUrl }, { status: 502 });
  }
}
