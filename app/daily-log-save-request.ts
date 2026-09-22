// A missing response is not proof that the transaction failed. Keep the draft
// and its expected version so Retry cannot overwrite a newer server record.
export const LOG_SAVE_TIMEOUT_MS = 30_000;
export const LOG_SAVE_SLOW_MS = 8_000;

export async function requestDailyLogSave(payload: unknown, onSlow: () => void) {
  const controller = new AbortController();
  const slowTimer = setTimeout(onSlow, LOG_SAVE_SLOW_MS);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch("/api/logbook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await response.json() as {
          saveVersion?: number;
          error?: string;
        };
        return { response, result };
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("The server has not confirmed this save. Keep this page open and retry. If the first save completed, you may be asked to reload and review it."));
          controller.abort();
        }, LOG_SAVE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(timeout);
  }
}
