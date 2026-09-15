'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import { refreshPermissionsAfterCurrent } from './use-permissions';
import { createOperationalLiveClient, createOperationalRefreshQueue } from './operational-live-client';
import { listenOperationalSignals, retainOperationalScope, type OperationalScope, type OperationalSection } from './operational-signals';
import { chicagoOperationalContext } from './operational-day';
let shared: ReturnType<typeof createOperationalLiveClient> | undefined;
function liveClient() {
  if (!shared) {
    shared = createOperationalLiveClient({ now: Date.now, catchUp: refreshPermissionsAfterCurrent, connect(topic, change, status) {
      const client = getSupabaseBrowserClient();
      const channel = client.channel(topic, { config: { private: true } }).on('broadcast', { event: 'changed' }, event => change(event.payload)).subscribe(value => status(value === 'SUBSCRIBED'));
      return () => { void client.removeChannel(channel); };
    } });
    listenOperationalSignals(value => shared?.accept(value));
  }
  return shared;
}
export function useOperationalUpdates({ scope, sections, refresh, fallbackMs, enabled = true, nextChangeAt, nextCalendarChange, readFailed = false }: {
  scope: OperationalScope; sections: readonly OperationalSection[]; refresh: (sections?: readonly OperationalSection[]) => Promise<unknown>;
  fallbackMs: number; enabled?: boolean; nextChangeAt?: number; nextCalendarChange?: number; readFailed?: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const deadline = useRef(nextChangeAt);
  const calendarDeadline = useRef(nextCalendarChange);
  const failedRead = useRef(readFailed);
  useEffect(() => { deadline.current = nextChangeAt; }, [nextChangeAt]);
  useEffect(() => { calendarDeadline.current = nextCalendarChange; }, [nextCalendarChange]);
  useEffect(() => { failedRead.current = readFailed; }, [readFailed]);
  const key = sections.join(',');
  useEffect(() => {
    if (!enabled) return;
    const client = liveClient();
    let alive = true, lastRead = 0, consumedDeadline = 0, consumedCalendar = 0, lastBoundary = '', fullRead = true;
    const changedSections = new Set<OperationalSection>();
    const updateStatus = () => { if (alive) setConnected(client.healthy(scope)); };
    const queue = createOperationalRefreshQueue(async () => {
      lastRead = Date.now();
      const requested = fullRead ? undefined : [...changedSections];
      fullRead = false; changedSections.clear();
      await refresh(requested);
    });
    const changed = (sections?: readonly OperationalSection[]) => {
      if (sections) sections.forEach(section => changedSections.add(section)); else fullRead = true;
      void queue.request();
    };
    const releaseScope = retainOperationalScope(scope);
    const unsubscribe = client.subscribe({ scope, sections: key.split(',') as OperationalSection[], changed, status: updateStatus });
    void refreshPermissionsAfterCurrent();
    const initial = window.setTimeout(changed, 0);
    const resume = () => { if (document.visibilityState !== 'hidden') { changed(); void refreshPermissionsAfterCurrent(); } };
    const offline = () => { client.reset(); updateStatus(); };
    // Clock checks are LOCAL. They do not request data unless a due boundary,
    // missed-event reconciliation, or unhealthy-connection fallback is reached.
    const timer = window.setInterval(() => {
      const now = Date.now();
      const context = chicagoOperationalContext(new Date(now));
      const boundary = `${context.calendarDate}:${Math.floor(context.minutes / 360)}`;
      const boundaryChanged = Boolean(lastBoundary && lastBoundary !== boundary);
      lastBoundary = boundary;
      const due = deadline.current ?? 0;
      const timeChanged = due > 0 && due !== consumedDeadline && now >= due;
      if (timeChanged) consumedDeadline = due;
      const calendarDue = calendarDeadline.current ?? 0;
      const calendarNow = Date.parse(`${context.calendarDate}T00:00:00Z`) / 60_000 + context.minutes;
      const calendarChanged = calendarDue > 0 && calendarDue !== consumedCalendar && calendarNow >= calendarDue;
      if (calendarChanged) consumedCalendar = calendarDue;
      updateStatus();
      if (boundaryChanged || timeChanged || calendarChanged || now - lastRead >= (client.healthy(scope) && !failedRead.current ? 300_000 : fallbackMs)) changed();
    }, 1000);
    window.addEventListener('online', resume); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', resume);
    return () => { alive = false; queue.dispose(); unsubscribe(); releaseScope(); window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener('online', resume); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', resume); };
  }, [scope, key, refresh, fallbackMs, enabled]);
  return connected;
}
