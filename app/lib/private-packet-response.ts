import { createHash } from 'node:crypto';

/** Call only AFTER current authorization and authoritative reads succeed.
 * No shared/CDN data cache, no permission TTL, and no skipped database checks.
 */
export function privatePacketResponse(request: Request, payload: unknown, options: {
  headers?: HeadersInit; fingerprint?: unknown;
} = {}) {
  const revision = createHash('sha256').update(JSON.stringify(options.fingerprint ?? payload)).digest('hex');
  const headers = new Headers(options.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('x-content-revision', revision);
  if (request.headers.get('x-content-revision') === revision) return new Response(null, { status: 204, headers });
  return Response.json(payload, { headers });
}
