/** Nonessential UI only. Never use this to suspend CAD or designated monitors. */
export function startVisiblePolling(run: (signal: AbortSignal) => Promise<void>, interval = 60000) {
  let stopped = false;
  let active: AbortController | null = null;
  const refresh = async () => {
    if (stopped || document.hidden || active) return;
    const controller = new AbortController();
    active = controller;
    try { await run(controller.signal); }
    finally { if (active === controller) active = null; }
  };
  const visibility = () => {
    if (document.hidden) { active?.abort(); active = null; }
    else void refresh();
  };
  const reconnect = () => { void refresh(); };
  const initial = window.setTimeout(reconnect, 0);
  const timer = window.setInterval(reconnect, interval);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', reconnect);
  return { refresh, stop() {
    stopped = true; active?.abort(); active = null;
    window.clearTimeout(initial); window.clearInterval(timer);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('online', reconnect);
  } };
}
