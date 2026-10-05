type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Store only a digest and random reference, never repair details or staff names. */
export function createInventorySaveReferences(store?: Store) {
  const pending = new Map<string, string>();
  const storage = () => {
    try { return store || (typeof window !== 'undefined' ? window.sessionStorage : undefined); }
    catch { return undefined; }
  };
  return {
    async acquire(payload: Record<string, unknown>, actor: string) {
      const bytes = new TextEncoder().encode(JSON.stringify([actor, payload]));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const key = 'inventory-save:v1:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      let id = pending.get(key);
      try { id ||= storage()?.getItem(key) || undefined; } catch { /* Memory fallback. */ }
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();
      pending.set(key, id);
      try { storage()?.setItem(key, id); } catch { /* Memory fallback. */ }
      return { key, id };
    },
    confirm(key: string) {
      pending.delete(key);
      try { storage()?.removeItem(key); } catch { /* The original receipt remains safe to replay. */ }
    },
  };
}
