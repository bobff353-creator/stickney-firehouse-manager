export const upstreamPortalOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";

export async function fetchUpstream(request: Request, pathname: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  const incoming = new URL(request.url);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  return fetch(new URL(pathname, upstreamPortalOrigin), {
    method: "GET",
    headers,
    redirect: "manual",
    cache: "no-store",
  });
}
