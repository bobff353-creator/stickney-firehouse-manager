import { normalizeAladtecSchedule, type AladtecMember, type AladtecSchedule, type AladtecTimeRecord } from "../../aladtec-schedule";

const externalUrl = "https://secure11.aladtec.com/stickneyfire/index.php?action=manage_schedule_view_schedule&schedule_view=daily_blocks";
const defaultBaseUrl = "https://secure11.aladtec.com/stickneyfire/api/v3";

type AladtecResponse<T> = { data?: T; access_token?: string };

async function getRuntimeConfiguration() {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    ALADTEC_BASE_URL?: string;
    ALADTEC_CLIENT_ID?: string;
    ALADTEC_CLIENT_SECRET?: string;
  };
  return {
    baseUrl: (runtime.ALADTEC_BASE_URL || defaultBaseUrl).replace(/\/+$/, ""),
    clientId: runtime.ALADTEC_CLIENT_ID || "",
    clientSecret: runtime.ALADTEC_CLIENT_SECRET || "",
  };
}

async function aladtecJson<T>(url: string, token: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Aladtec schedule request failed");
  return response.json() as Promise<AladtecResponse<T>>;
}

export async function GET() {
  const now = new Date();
  const rangeStop = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  try {
    const configuration = await getRuntimeConfiguration();
    if (!configuration.clientId || !configuration.clientSecret) {
      return Response.json({
        connected: false,
        status: "setup_required",
        message: "Aladtec API connection required",
        externalUrl,
        rangeStart: now.toISOString(),
        rangeEnd: rangeStop.toISOString(),
        items: [],
      }, { headers: { "cache-control": "private, max-age=60" } });
    }

    const tokenResponse = await fetch(`${configuration.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: configuration.clientId, client_secret: configuration.clientSecret }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) throw new Error("Aladtec authentication failed");
    const tokenPayload = await tokenResponse.json() as AladtecResponse<never>;
    if (!tokenPayload.access_token) throw new Error("Aladtec authentication returned no token");

    const query = new URLSearchParams({
      range_start_datetime: now.toISOString(),
      range_stop_datetime: rangeStop.toISOString(),
    });
    const [scheduled, members, schedules] = await Promise.all([
      aladtecJson<Array<{ time_records?: AladtecTimeRecord[] }>>(`${configuration.baseUrl}/scheduled-time?${query}`, tokenPayload.access_token),
      aladtecJson<AladtecMember[]>(`${configuration.baseUrl}/members?include_inactive=false`, tokenPayload.access_token),
      aladtecJson<AladtecSchedule[]>(`${configuration.baseUrl}/schedules`, tokenPayload.access_token),
    ]);
    const items = normalizeAladtecSchedule(members.data ?? [], schedules.data ?? [], scheduled.data ?? []);
    return Response.json({
      connected: true,
      status: "live",
      externalUrl,
      asOf: new Date().toISOString(),
      rangeStart: now.toISOString(),
      rangeEnd: rangeStop.toISOString(),
      items,
    }, { headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return Response.json({
      connected: false,
      status: "unavailable",
      message: "Aladtec schedule is temporarily unavailable",
      externalUrl,
      rangeStart: now.toISOString(),
      rangeEnd: rangeStop.toISOString(),
      items: [],
    }, { headers: { "cache-control": "private, max-age=60" } });
  }
}
