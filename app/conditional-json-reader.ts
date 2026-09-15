/** Component-owned memory only. A 204 confirms the saved packet with a NEW
 * authorized server read. Errors never become successes or offline fallbacks.
 */
export function createConditionalJsonReader(request: typeof fetch = fetch) {
  const packets = new Map<string, { revision: string; body: string }>();
  let generation = 0;
  return {
    clear() { generation++; packets.clear(); },
    async read(url: string, init: RequestInit = {}): Promise<Response> {
      const own = generation;
      const prior = packets.get(url);
      const headers = new Headers(init.headers);
      if (prior) headers.set('x-content-revision', prior.revision);
      const response = await request(url, { ...init, cache: 'no-store', headers });
      if (init.signal?.aborted || own !== generation) throw new DOMException('Read canceled', 'AbortError');
      if ([401, 403, 423].includes(response.status)) { generation++; packets.clear(); return response; }
      if (!response.ok) { packets.delete(url); return response; }
      if (response.status === 204) {
        if (!prior) throw new Error('An unchanged response had no saved packet. Retry to reload.');
        return new Response(prior.body, { status: 200, headers: response.headers });
      }
      const body = await response.text();
      if (init.signal?.aborted || own !== generation) throw new DOMException('Read canceled', 'AbortError');
      const revision = response.headers.get('x-content-revision');
      if (revision) {
        if (packets.size >= 16 && !packets.has(url)) packets.delete(packets.keys().next().value!);
        packets.set(url, { revision, body });
      } else packets.delete(url);
      return new Response(body, { status: response.status, headers: response.headers });
    },
  };
}
