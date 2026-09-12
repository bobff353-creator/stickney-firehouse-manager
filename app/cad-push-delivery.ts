import { buildCadPushPayload, type CadPushIncident } from './cad-push';

export type PushJob = {
  id: string; lease: string; eventId: string; departmentId: string;
  endpoint: string; p256dh: string; auth: string; incident: CadPushIncident; ttl: number;
};
export type PushOutcome = { id: string; lease: string; status: number };
export type PushDeliveryStore = {
  claim(incidentId?: string): Promise<PushJob[]>;
  finish(outcomes: PushOutcome[]): Promise<void>;
};

/** Provider acceptance is not proof that a device displayed the alert. */
export async function drainCadPush(store: PushDeliveryStore,
  send: (job: PushJob, payload: object, ttl: number) => Promise<unknown>, incidentId?: string) {
  let accepted = 0, failed = 0, batches = 0;
  // Bounded concurrency/time: <=50 recipients per claim, <=4 x 8-second sends.
  while (batches < 4) {
    const jobs = await store.claim(incidentId);
    if (!jobs.length) break;
    const outcomes = await Promise.all(jobs.map(async job => {
      const payload = { ...buildCadPushPayload(job.incident),
        eventId: job.eventId, tag: `cad-${job.departmentId}-${job.eventId}` };
      let status = 201;
      try { await send(job, payload, job.ttl); accepted += 1; }
      catch (error) {
        const candidate = Number((error as { statusCode?: unknown } | null)?.statusCode);
        status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 0;
        failed += 1;
      }
      return { id: job.id, lease: job.lease, status };
    }));
    // One atomic acknowledgement for the batch, not one RPC per subscription.
    // If it fails, leave leases intact for recovery; never falsely mark accepted.
    await store.finish(outcomes);
    batches += 1;
  }
  return { accepted, failed, batches };
}
