import { ensureDatabase } from '../../../../db/bootstrap';
import { columns, decode, nerisBoundary, nerisJson, type Stored } from '../../../neris/server';
import { reportingDesk } from '../../../neris/reporting-desk';
import type { CadCall } from '../../../neris/cad-location';
export async function GET(request: Request) {
  const denied = nerisBoundary(request); if (denied) return denied;
  try {
    const db = await ensureDatabase(), department = request.headers.get('x-department-id')!;
    const [calls, records] = await Promise.all([
      db.prepare('SELECT incident_id id,call_type callType,address,city,narrative,responding_units units,dispatched_at dispatchedAt,source_system source FROM dispatch_incidents ORDER BY dispatched_at DESC,incident_id DESC LIMIT 1001').all<CadCall>(),
      db.prepare(`SELECT ${columns} FROM neris_pilot_records WHERE department_id=? AND kind='incident' ORDER BY updated_at DESC LIMIT 2001`).bind(department).all<Stored>(),
    ]);
    if (records.results.length > 2000) throw Error('Report limit');
    return nerisJson({ rows: reportingDesk(calls.results.slice(0, 1000), records.results.map(decode)), hasOlderCalls: calls.results.length > 1000, generatedAt: new Date().toISOString(), scope: 'Up to 1,000 most recent saved CAD calls. Exact CAD source IDs only; manual Daily Log calls and reports without CAD links are not reconciled here. Local review does not prove official submission.' });
  } catch { return nerisJson({ error: 'Reporting coverage could not load. Retry; no reports have changed.' }, 503); }
}
