import { operationalSections, type OperationalSection, type OperationalScope, type OperationalSignal } from './operational-signals';
type Listener = { scope: OperationalScope; sections: readonly OperationalSection[]; changed: (sections: readonly OperationalSection[]) => void; status: () => void };
type ChannelState = { topic: string; expires: number; checked: number; connected: boolean; caughtUp: boolean; queued: boolean; revisions: Partial<Record<OperationalSection, string>>; leave: () => void };
type Dependencies = {
  now: () => number;
  catchUp: () => Promise<unknown>;
  connect: (topic: string, changed: (value: unknown) => void, status: (connected: boolean) => void) => () => void;
};
const emptyChannel = (): ChannelState => ({ topic: '', expires: 0, checked: 0, connected: false, caughtUp: false, queued: false, revisions: {}, leave: () => {} });
const validRevision = (value: unknown): value is string => typeof value === 'string' && /^\d{1,19}$/.test(value);
export function createOperationalLiveClient(deps: Dependencies) {
  const listeners = new Set<Listener>();
  const channels = new Map<OperationalScope, ChannelState>();
  let identity = '';
  function status(scope: OperationalScope) { listeners.forEach(listener => { if (listener.scope === scope) listener.status(); }); }
  function changed(scope: OperationalScope, sections: readonly OperationalSection[]) {
    listeners.forEach(listener => { if (listener.scope === scope && listener.sections.some(section => sections.includes(section))) listener.changed(sections); });
  }
  function stop(scope: OperationalScope) { const channel = channels.get(scope); channels.delete(scope); channel?.leave(); status(scope); }
  function reset() { [...channels.keys()].forEach(stop); identity = ''; }
  function healthy(scope: OperationalScope) {
    const channel = channels.get(scope), now = deps.now();
    return Boolean(channel?.connected && channel.caughtUp && channel.queued && now < channel.expires && now - channel.checked < 25_000);
  }
  function accept(signal: OperationalSignal | null) {
    if (!signal || !signal.departmentId || !signal.userId || !Array.isArray(signal.leases) || signal.leases.length > 2 || !Number.isFinite(Date.parse(signal.serverTime))) { reset(); return; }
    const nextIdentity = `${signal.departmentId}:${signal.userId}`;
    if (identity && identity !== nextIdentity) reset();
    identity = nextIdentity;
    for (const scope of ['respond', 'board'] as const) {
      if (![...listeners].some(listener => listener.scope === scope)) { stop(scope); continue; }
      const lease = signal.leases.find(item => item.scope === scope);
      const remaining = lease ? Date.parse(lease.expiresAt) - Date.parse(signal.serverTime) : 0;
      const prefix = `operations:${signal.departmentId}:${scope}:`;
      if (!lease || !lease.topic.startsWith(prefix) || !/^\d+$/.test(lease.topic.slice(prefix.length)) || !(remaining > 0 && remaining <= 60_001) || !lease.revisions || Object.values(lease.revisions).some(value => !validRevision(value))) { stop(scope); continue; }
      let channel = channels.get(scope);
      const freshTopic = !channel || channel.topic !== lease.topic;
      const previous = channel?.revisions ?? {};
      if (freshTopic) {
        channel?.leave();
        channel = emptyChannel();
        channel.topic = lease.topic;
        channels.set(scope, channel);
      }
      const current = channel!;
      current.expires = deps.now() + remaining;
      current.checked = deps.now();
      current.queued = lease.queued === true;
      const sections = operationalSections.filter(section => scope === 'respond' ? section === 'respond' : section !== 'respond');
      const missed = sections.filter(section => (previous[section] ?? '0') !== (lease.revisions[section] ?? '0'));
      // Never move backwards when a live event overtakes an in-flight snapshot.
      current.revisions = Object.fromEntries(sections.map(section => [section, BigInt(previous[section] ?? '0') > BigInt(lease.revisions[section] ?? '0') ? previous[section] : lease.revisions[section] ?? '0']));
      if (missed.some(section => BigInt(lease.revisions[section] ?? '0') > BigInt(previous[section] ?? '0'))) changed(scope, missed);
      if (freshTopic) {
        try { current.leave = deps.connect(current.topic, value => {
          if (channels.get(scope) !== current || deps.now() >= current.expires || !value || typeof value !== 'object') return;
          const event = value as { section?: OperationalSection; revision?: unknown };
          if (!event.section || !sections.includes(event.section) || !validRevision(event.revision)) return;
          if (BigInt(event.revision) <= BigInt(current.revisions[event.section] ?? '0')) return;
          current.revisions[event.section] = event.revision;
          changed(scope, [event.section]);
        }, connected => {
          if (channels.get(scope) !== current) return;
          current.connected = connected;
          current.caughtUp = false;
          status(scope);
          if (connected) void deps.catchUp().then(() => {
            if (channels.get(scope) !== current || !current.connected) return;
            current.caughtUp = true;
            status(scope);
          }).catch(() => { current.caughtUp = false; status(scope); });
        }); } catch { current.connected = false; current.caughtUp = false; }
      }
      status(scope);
    }
  }
  return {
    accept, healthy, reset,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); if (![...listeners].some(item => item.scope === listener.scope)) stop(listener.scope); if (!listeners.size) identity = ''; };
    },
  };
}

// At most one read in flight. Events during a read must schedule another read,
// rather than disappearing behind a component's existing single-flight guard.
export function createOperationalRefreshQueue(read: () => Promise<unknown>) {
  let active = true, pending = false, running = false;
  async function request() {
    if (!active) return;
    pending = true;
    if (running) return;
    running = true;
    try { while (active && pending) { pending = false; try { await read(); } catch { /* view owns its error state */ } } }
    finally { running = false; }
  }
  return { request, dispose() { active = false; pending = false; } };
}
