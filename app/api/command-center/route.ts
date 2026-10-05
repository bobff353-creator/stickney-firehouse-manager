import { hasPermission } from '../../server-permissions';
import { ensureDatabase } from '../../../db/bootstrap';
import { buildPayrollDetails, buildStaffingDetails } from '../../command-center-analytics';
import type { PayrollSourceRow, RateHistoryRow } from '../../command-center-analytics';
import { chiefCsv, reportRange, type AnalyticsSources, type ReportDay } from '../../reporting-metrics';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
function equipmentCount(raw: unknown) {
  const parsed = JSON.parse(String(raw || '{}'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid equipment observations');
  return Object.values(parsed as Record<string, { status?: string }>).filter(item => item?.status && item.status !== 'Present').length;
}
function dates() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const from = new Date(today + 'T12:00:00Z'); from.setUTCDate(from.getUTCDate() - 365);
  const year = Number(today.slice(0, 4)), startYear = today.slice(5) >= '05-01' ? year : year - 1;
  return { earliest: from.toISOString().slice(0, 10), latest: today, startDate: startYear + '-05-01', endDate: (startYear + 1) + '-04-30' };
}
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'command_center.view')) return json({ error: 'Command Center access is required.' }, 403);
    const [canLog, canPayroll, canIntegrations] = await Promise.all(['daily_log.view', 'payroll.manage', 'settings.manage'].map(key => hasPermission(request, db, key as 'daily_log.view' | 'payroll.manage' | 'settings.manage')));
    const range = dates(), params = new URL(request.url).searchParams;
    let selected;
    try { if (params.get('format') === 'csv') selected = reportRange(params.get('start') || '', params.get('end') || '', range.earliest, range.latest); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid report dates.' }, 400); }
    const sources: AnalyticsSources = { calls: canLog ? 'ready' : 'restricted', staffing: canLog ? 'ready' : 'restricted', equipment: canLog ? 'ready' : 'restricted', payroll: canPayroll ? 'ready' : 'restricted' };
    const map = new Map<string, ReportDay>();
    const metric = (date: string) => { if (!map.has(date)) map.set(date, { date, calls: 0, staffingGaps: 0, equipmentIssues: 0, overtimeHours: 0, aoHours: 0, payrollCost: 0 }); return map.get(date)!; };
    const [staffingResult, callsResult, equipmentResult, payrollResult, integrationResult] = await Promise.allSettled([
      canLog ? db.prepare("SELECT l.log_date AS date, shifts.shift_key AS shiftKey, COUNT(s.employee_id) AS filled FROM daily_logs l CROSS JOIN (SELECT 'morning' AS shift_key UNION ALL SELECT 'afternoon' UNION ALL SELECT 'overnight') shifts LEFT JOIN daily_log_staffing s ON s.log_date=l.log_date AND s.shift_key=shifts.shift_key AND s.employee_id IS NOT NULL WHERE l.log_date>=? AND l.log_date<=? GROUP BY l.log_date,shifts.shift_key").bind(range.earliest, range.latest).all() : Promise.resolve(null),
      canLog ? Promise.all([
        db.prepare('SELECT log_date AS date,call_type AS callType,COUNT(*) AS count FROM daily_log_calls WHERE log_date>=? AND log_date<=? GROUP BY log_date,call_type').bind(range.earliest, range.latest).all(),
        db.prepare('SELECT log_date AS date,time_out AS timeOut FROM daily_log_calls WHERE log_date>=? AND log_date<=? ORDER BY log_date,time_out').bind(range.earliest, range.latest).all(),
      ]) : Promise.resolve(null),
      canLog ? db.prepare('SELECT log_date AS date,sign_in_equipment AS signInEquipment,sign_out_equipment AS signOutEquipment FROM daily_log_approvals WHERE log_date>=? AND log_date<=?').bind(range.earliest, range.latest).all().then(result => result.results.map(row => ({ date: String(row.date), count: equipmentCount(row.signInEquipment) + equipmentCount(row.signOutEquipment) }))) : Promise.resolve(null),
      canPayroll ? (async () => {
        // Include the entire pay period before allocating its daily gross-pay deltas.
        const [entries, settings, rates] = await Promise.all([
          db.prepare('SELECT t.employee_id AS employeeId,t.period_start AS periodStart,t.work_date AS date,t.category,t.hours,ps.label AS rank,ps.id AS payScaleId,ps.regular_rate AS regularRate,ps.overtime_rate AS overtimeRate,ps.holiday_rate AS holidayRate,COALESCE(ep.is_dpw,0) AS isDpw FROM time_entries t JOIN employees e ON e.id=t.employee_id JOIN pay_scales ps ON ps.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE EXISTS (SELECT 1 FROM time_entries visible WHERE visible.employee_id=t.employee_id AND visible.period_start=t.period_start AND visible.work_date>=? AND visible.work_date<=?) ORDER BY t.employee_id,t.period_start,t.work_date,t.category').bind(range.earliest, range.latest).all<PayrollSourceRow>(),
          db.prepare('SELECT overtime_threshold AS overtimeThreshold,acting_officer_premium AS actingOfficerPremium,dpw_multiplier AS dpwMultiplier FROM payroll_settings WHERE id=1').first<{ overtimeThreshold: number; actingOfficerPremium: number; dpwMultiplier: number }>(),
          db.prepare('SELECT pay_scale_id AS payScaleId,effective_date AS effectiveDate,regular_rate AS regularRate,overtime_rate AS overtimeRate,holiday_rate AS holidayRate FROM pay_rate_history ORDER BY pay_scale_id,effective_date DESC').all<RateHistoryRow>(),
        ]);
        if (!settings || !Object.values(settings).every(value => value !== null && value !== undefined && Number.isFinite(Number(value))) || Number(settings.overtimeThreshold) < 0 || Number(settings.actingOfficerPremium) < 0 || Number(settings.dpwMultiplier) <= 0) throw Error('Payroll settings unavailable');
        return { details: buildPayrollDetails(entries.results, rates.results, settings).filter(row => row.date >= range.earliest && row.date <= range.latest), settings };
      })() : Promise.resolve(null),
      canIntegrations ? db.prepare("SELECT status,COUNT(*) AS count,MAX(received_at) AS latest FROM cad_inbound_receipts WHERE provider='cis' GROUP BY status").all() : Promise.resolve(null),
    ]);
    const staffingDetails = staffingResult.status === 'fulfilled' && staffingResult.value ? buildStaffingDetails(staffingResult.value.results.map(row => ({ date: String(row.date), shiftKey: String(row.shiftKey), filled: Number(row.filled || 0) }))) : [];
    if (staffingResult.status === 'rejected') sources.staffing = 'unavailable';
    for (const row of staffingDetails) metric(row.date).staffingGaps += row.gaps;
    const responseTypes: Record<string, number> = {}, responseTypeDaily: Array<{ date: string; callType: string; count: number }> = [];
    const callTiming = callsResult.status === 'fulfilled' && callsResult.value ? callsResult.value[1].results : [];
    if (callsResult.status === 'rejected') sources.calls = 'unavailable';
    if (callsResult.status === 'fulfilled' && callsResult.value) for (const row of callsResult.value[0].results) { const date = String(row.date), callType = String(row.callType || 'Unspecified'), count = Number(row.count); metric(date).calls += count; responseTypes[callType] = (responseTypes[callType] || 0) + count; responseTypeDaily.push({ date, callType, count }); }
    if (equipmentResult.status === 'rejected') sources.equipment = 'unavailable';
    if (equipmentResult.status === 'fulfilled' && equipmentResult.value) for (const row of equipmentResult.value) metric(row.date).equipmentIssues += row.count;
    const payrollDetails = payrollResult.status === 'fulfilled' && payrollResult.value ? payrollResult.value.details : [];
    if (payrollResult.status === 'rejected') sources.payroll = 'unavailable';
    for (const row of payrollDetails) { const day = metric(row.date); day.overtimeHours += row.overtimeHours; day.aoHours += row.category === 'actingOfficer' ? row.hours : 0; day.payrollCost += row.cost; }
    const daily = [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), generatedAt = new Date().toISOString();
    const payload = { daily, responseTypes, responseTypeDaily, callTiming, staffingDetails, payrollDetails, sources, coverage: { earliest: range.earliest, latest: range.latest }, payrollSettings: payrollResult.status === 'fulfilled' ? payrollResult.value?.settings ?? null : null,
      fiscalYear: { startDate: range.startDate, endDate: range.endDate, payToDate: sources.payroll === 'ready' ? daily.filter(row => row.date >= range.startDate && row.date <= range.latest).reduce((sum, row) => sum + row.payrollCost, 0) : null }, generatedAt,
      integrations: { cad: { state: !canIntegrations ? 'restricted' : integrationResult.status === 'rejected' ? 'unavailable' : 'app_receipts_only', credentialsConfigured: canIntegrations ? Boolean(process.env.CIS_CAD_WEBHOOK_SECRET) : null, receipts: integrationResult.status === 'fulfilled' ? integrationResult.value?.results ?? [] : [], liveVerified: false }, neris: { state: 'not_connected', submitted: false, receipt: null }, ai: { state: 'not_enabled', note: 'This report uses saved records and defined calculations. No AI facts or automatic changes.' } },
    };
    if (selected) return new Response(chiefCsv(daily, sources, selected.start, selected.end, generatedAt, new URL(request.url).origin), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="chief-report-' + selected.start + '-' + selected.end + '.csv"', 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    return json(payload);
  } catch { return json({ error: 'Command Center could not load. Retry; saved records have not changed.' }, 503); }
}
