const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
const weatherComUrl = "https://weather.com/us/illinois/city/berwyn/today";
forecastUrl.search = new URLSearchParams({
  latitude: "41.8189",
  longitude: "-87.7734",
  daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max",
  hourly: "weather_code,temperature_2m,precipitation_probability,wind_speed_10m",
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

type ForecastDay = { date: string; condition: string; high: number; low: number; precipitationChance: number; windGust: number };
type ForecastHour = { time: string; condition: string; temperature: number; precipitationChance: number; windSpeed: number };
type ForecastBundle = { days: ForecastDay[]; hours: ForecastHour[] };

function nextFourHours<T extends { time: string }>(periods: T[]) {
  const now = Date.now();
  const future = periods.filter((period) => new Date(period.time).getTime() >= now);
  return (future.length >= 4 ? future : periods).slice(0, 4);
}

async function openMeteoForecast(): Promise<ForecastBundle> {
  const response = await fetch(forecastUrl, {
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!response.ok) throw new Error("Open-Meteo unavailable");
  const payload = await response.json() as {
      utc_offset_seconds?: number;
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        wind_gusts_10m_max?: number[];
      };
      hourly?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
        wind_speed_10m?: number[];
      };
    };
  const daily = payload.daily;
  if (!daily?.time || daily.time.length < 2) throw new Error("Incomplete Open-Meteo forecast");
  const days = daily.time.slice(0, 2).map((date, index) => ({
      date,
      condition: condition(Number(daily.weather_code?.[index] ?? -1)),
      high: Math.round(Number(daily.temperature_2m_max?.[index] ?? 0)),
      low: Math.round(Number(daily.temperature_2m_min?.[index] ?? 0)),
      precipitationChance: Math.round(Number(daily.precipitation_probability_max?.[index] ?? 0)),
      windGust: Math.round(Number(daily.wind_gusts_10m_max?.[index] ?? 0)),
  }));
  const hourly = payload.hourly;
  if (!hourly?.time?.length) throw new Error("Incomplete Open-Meteo hourly forecast");
  const utcOffsetMilliseconds = Number(payload.utc_offset_seconds ?? 0) * 1000;
  const hours = nextFourHours(hourly.time.map((time, index) => ({
    time: new Date(new Date(`${time}:00Z`).getTime() - utcOffsetMilliseconds).toISOString(),
    condition: condition(Number(hourly.weather_code?.[index] ?? -1)),
    temperature: Math.round(Number(hourly.temperature_2m?.[index] ?? 0)),
    precipitationChance: Math.round(Number(hourly.precipitation_probability?.[index] ?? 0)),
    windSpeed: Math.round(Number(hourly.wind_speed_10m?.[index] ?? 0)),
  })));
  return { days, hours };
}

async function nationalWeatherServiceForecast(): Promise<ForecastBundle> {
  const headers = { "user-agent": "Stickney Fire Department Operations Portal weather@stickneyil.gov", accept: "application/geo+json" };
  const pointsResponse = await fetch("https://api.weather.gov/points/41.8506,-87.7937", {
    headers,
    signal: AbortSignal.timeout(8000),
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!pointsResponse.ok) throw new Error("NWS location lookup unavailable");
  const points = await pointsResponse.json() as { properties?: { forecast?: string; forecastHourly?: string } };
  const endpoint = points.properties?.forecast;
  const hourlyEndpoint = points.properties?.forecastHourly;
  if (!endpoint?.startsWith("https://api.weather.gov/") || !hourlyEndpoint?.startsWith("https://api.weather.gov/")) throw new Error("Invalid NWS forecast endpoint");
  const nwsOptions = {
    headers,
    signal: AbortSignal.timeout(8000),
    cf: { cacheTtl: 900, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } };
  const [forecastResponse, hourlyResponse] = await Promise.all([fetch(endpoint, nwsOptions), fetch(hourlyEndpoint, nwsOptions)]);
  if (!forecastResponse.ok || !hourlyResponse.ok) throw new Error("NWS forecast unavailable");
  const forecast = await forecastResponse.json() as {
    properties?: {
      periods?: Array<{
        startTime: string;
        isDaytime: boolean;
        temperature: number;
        temperatureUnit: string;
        shortForecast: string;
        probabilityOfPrecipitation?: { value?: number | null };
        windSpeed?: string;
      }>;
    };
  };
  const hourlyForecast = await hourlyResponse.json() as typeof forecast;
  const grouped = new Map<string, NonNullable<NonNullable<typeof forecast.properties>["periods"]>>();
  for (const period of forecast.properties?.periods ?? []) {
    const date = period.startTime.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), period]);
  }
  const days = [...grouped.entries()].slice(0, 2).map(([date, periods]) => {
    const daytime = periods.find((period) => period.isDaytime);
    const nighttime = periods.find((period) => !period.isDaytime);
    const temperatures = periods.map((period) => period.temperature);
    const precipitationChance = Math.max(...periods.map((period) => Number(period.probabilityOfPrecipitation?.value ?? 0)));
    const windGust = Math.max(...periods.flatMap((period) => (period.windSpeed ?? "").match(/\d+/g)?.map(Number) ?? [0]));
    return {
      date,
      condition: daytime?.shortForecast ?? nighttime?.shortForecast ?? "Forecast available",
      high: daytime?.temperature ?? Math.max(...temperatures),
      low: nighttime?.temperature ?? Math.min(...temperatures),
      precipitationChance,
      windGust,
    };
  });
  if (days.length < 2) throw new Error("Incomplete NWS forecast");
  const hours = nextFourHours((hourlyForecast.properties?.periods ?? []).map((period) => ({
    time: period.startTime,
    condition: period.shortForecast,
    temperature: period.temperature,
    precipitationChance: Number(period.probabilityOfPrecipitation?.value ?? 0),
    windSpeed: Math.max(...((period.windSpeed ?? "").match(/\d+/g)?.map(Number) ?? [0])),
  })));
  if (hours.length < 4) throw new Error("Incomplete NWS hourly forecast");
  return { days, hours };
}

export async function GET() {
  try {
    let forecast: ForecastBundle;
    let source: string;
    try {
      forecast = await nationalWeatherServiceForecast();
      source = "National Weather Service";
    } catch {
      forecast = await openMeteoForecast();
      source = "Open-Meteo backup";
    }
    return Response.json({ location: "Berwyn, IL", ...forecast, source, detailUrl: weatherComUrl }, { headers: { "cache-control": "public, max-age=300, s-maxage=900" } });
  } catch {
    return Response.json({ error: "Weather forecast temporarily unavailable", detailUrl: weatherComUrl }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
