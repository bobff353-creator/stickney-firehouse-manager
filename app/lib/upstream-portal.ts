export const upstreamPortalOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";
const upstreamTimeoutMs = 15_000;

export async function fetchUpstream(request: Request, pathname: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  const incoming = new URL(request.url);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  try {
    return await fetch(new URL(pathname, upstreamPortalOrigin), {
      method: "GET",
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch {
    return Response.json(
      { error: "The department portal is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
    );
  }
}
