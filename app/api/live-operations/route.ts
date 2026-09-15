import { GET as dashboard } from '../dashboard/route';
import { GET as duties } from '../daily-duties/route';
import { GET as fleet } from '../suite-context/route';
import { privatePacketResponse } from '../../lib/private-packet-response';
import { verifyInventoryRequest, sessionFailureResponse } from '../../lib/inventory-session';

// One browser request, with each original handler retaining its full authority
// checks and call reconciliation. These are function calls, not internal HTTP.
export async function GET(request: Request) {
  const read = async (handler: (request: Request) => Promise<Response>, path: string) => {
    const url = new URL(path, request.url);
    const response = await handler(new Request(url, { headers: request.headers, signal: request.signal }));
    return { ok: response.ok, status: response.status, payload: await response.json().catch(() => null) };
  };
  try {
    const sources = { dashboard: [dashboard, '/api/dashboard?scope=live-operations'], duties: [duties, '/api/daily-duties?scope=live-operations'], fleet: [fleet, '/api/suite-context?scope=live-operations'] } as const;
    const requested = new Set(new URL(request.url).searchParams.get('parts')?.split(',') ?? Object.keys(sources));
    const names = (Object.keys(sources) as Array<keyof typeof sources>).filter(name => requested.has(name));
    if (!names.length) return Response.json({ error: 'Select a valid board section.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    // Partial refreshes must retain the full board's Inventory/session gate even
    // when unchanged fleet rows do not need downloading again.
    if (!names.includes('fleet')) {
      const session = await verifyInventoryRequest(request);
      if (!session.ok) return sessionFailureResponse(session);
      if (!session.context.grants.includes('operations_board.view')) return Response.json({ error: 'Live Operations access is required.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const results: Record<string, Awaited<ReturnType<typeof read>>> = Object.fromEntries(await Promise.all(names.map(async name => [name, await read(sources[name][0], sources[name][1])])));
    const denied = Object.values(results).find(result => [401, 403, 423].includes(result.status));
    if (denied) return Response.json({ error: 'Live Operations access could not be confirmed.' }, { status: denied.status, headers: { 'Cache-Control': 'private, no-store' } });
    // Never confirm a partial failure as unchanged; each panel keeps its normal
    // error behavior. The server read time isn't an operational content change.
    if (!Object.values(results).every(result => result.ok)) return Response.json(results, { headers: { 'Cache-Control': 'private, no-store' } });
    return privatePacketResponse(request, results, { fingerprint: {
      ...results, ...(results.dashboard ? { dashboard: { ...results.dashboard, payload: { ...results.dashboard.payload, asOf: null } } } : {}),
    } });
  } catch {
    return Response.json({ error: 'Live Operations could not refresh.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
