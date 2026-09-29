import type { HealthCheck } from './system-health-model';
export type JobRun = { status: string; startedAt: string; finishedAt: string | null; summary: string | null };
export function preplanJobHealth(run: JobRun | null, now = new Date()): HealthCheck {
  const base = { id: 'preplan-job', label: 'Overnight preplan check', verifiedAt: now.toISOString() };
  if (!run) return { ...base, state: 'unavailable', value: 'No verified run yet', detail: 'The scheduled job has not recorded a result. Check again after the next run.' };
  const age = now.getTime() - new Date(run.finishedAt || run.startedAt).getTime();
  if (run.status === 'failed') return { ...base, state: 'warning', value: 'Last run failed', detail: 'The expiration check failed. Open the deployment logs for daily-refresh; no successful check is being claimed.' };
  if (!Number.isFinite(age) || age < -300_000 || age > 30 * 3600_000) return { ...base, state: 'warning', value: 'Check overdue', detail: 'No completed check has been verified within 30 hours. Investigate the scheduled job.' };
  if (run.status !== 'succeeded' || !run.finishedAt) return { ...base, state: 'warning', value: age > 120_000 ? 'Run did not finish' : 'Running', detail: 'A run started, but no completion has been recorded.' };
  return { ...base, state: 'healthy', value: 'Completed', detail: `Finished ${new Date(run.finishedAt!).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false })} Central. ${run.summary || ''}` };
}
