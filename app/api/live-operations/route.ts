import { GET as dashboard } from '../dashboard/route';
import { GET as duties } from '../daily-duties/route';
import { GET as fleet } from '../suite-context/route';
import { privatePacketResponse } from '../../lib/private-packet-response';

// One browser request, with each original handler retaining its full authority
// checks and call reconciliation. These are function calls, not internal HTTP.
export async function GET(request: Request) {
  const read = async (handler: (request: Request) => Promise<Response>, path: string) => {
    const url = new URL(path, request.url);
    const response = await handler(new Request(url, { headers: request.headers, signal: request.signal }));
    return { ok: response.ok, status: response.status, payload: await response.json().catch(() => null) };
  };
  try {
    const [dashboardResult, dutiesResult, fleetResult] = await Promise.all([
      read(dashboard, '/api/dashboard?scope=live-operations'),
      read(duties, '/api/daily-duties?scope=live-operations'),
      read(fleet, '/api/suite-context?scope=live-operations'),
    ]);
    const results = { dashboard: dashboardResult, duties: dutiesResult, fleet: fleetResult };
    const denied = Object.values(results).find(result => [401, 403, 423].includes(result.status));
    if (denied) return Response.json({ error: 'Live Operations access could not be confirmed.' }, { status: denied.status, headers: { 'Cache-Control': 'private, no-store' } });
    // Never confirm a partial failure as unchanged; each panel keeps its normal
    // error behavior. The server read time isn't an operational content change.
    if (!Object.values(results).every(result => result.ok)) return Response.json(results, { headers: { 'Cache-Control': 'private, no-store' } });
    return privatePacketResponse(request, results, { fingerprint: {
      ...results, dashboard: { ...dashboardResult, payload: { ...dashboardResult.payload, asOf: null } },
    } });
  } catch {
    return Response.json({ error: 'Live Operations could not refresh.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
