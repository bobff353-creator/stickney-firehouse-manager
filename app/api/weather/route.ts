const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
forecastUrl.search = new URLSearchParams({
  latitude: "41.8189",
  longitude: "-87.7734",
  daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max",
  temperature_unit: "fahrenheit",
  wind_speed_unit: "mph",
  precipitation_unit: "inch",
  timezone: "America/Chicago",
  forecast_days: "2",
}).toString();

function condition(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed conditions";
}

export async function GET() {
  try {
    const response = await fetch(forecastUrl, {
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error("Forecast source unavailable");
    const payload = await response.json() as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        wind_gusts_10m_max?: number[];
      };
    };
    const daily = payload.daily;
    if (!daily?.time || daily.time.length < 2) throw new Error("Incomplete forecast");
    const days = daily.time.slice(0, 2).map((date, index) => ({
      date,
      condition: condition(Number(daily.weather_code?.[index] ?? -1)),
      high: Math.round(Number(daily.temperature_2m_max?.[index] ?? 0)),
      low: Math.round(Number(daily.temperature_2m_min?.[index] ?? 0)),
      precipitationChance: Math.round(Number(daily.precipitation_probability_max?.[index] ?? 0)),
      windGust: Math.round(Number(daily.wind_gusts_10m_max?.[index] ?? 0)),
    }));
    return Response.json({ location: "Stickney, IL", days }, { headers: { "cache-control": "public, max-age=300, s-maxage=900" } });
  } catch {
    return Response.json({ error: "Weather forecast temporarily unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
