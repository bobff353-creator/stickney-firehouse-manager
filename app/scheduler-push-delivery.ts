export type SchedulerPushJob = { id: string; lease: string; payload: object; endpoint: string; p256dh: string; auth: string; ttl: number };
export type SchedulerPushOutcome = { id: string; lease: string; status: number };
export async function drainSchedulerPush(store: {
  enqueue(): Promise<unknown>;
  claim(): Promise<SchedulerPushJob[]>;
  finish(outcomes: SchedulerPushOutcome[]): Promise<unknown>;
}, send: (job: SchedulerPushJob) => Promise<unknown>) {
  await store.enqueue();
  let accepted = 0, failed = 0, batches = 0;
  while (batches < 4) {
    const jobs = await store.claim();
    if (!jobs.length) break;
    const outcomes = await Promise.all(jobs.map(async job => {
      let status = 201;
      try { await send(job); accepted++; }
      catch (error) {
        const code = Number((error as { statusCode?: unknown })?.statusCode);
        status = Number.isInteger(code) && code >= 400 && code <= 599 ? code : 0;
        failed++;
      }
      return { id: job.id, lease: job.lease, status };
    }));
    await store.finish(outcomes);
    batches++;
  }
  return { accepted, failed, batches };
}
