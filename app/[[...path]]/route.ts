const upstreamOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";

const inventoryNavigation = '<script src="/inventory-route.js" defer></script>';

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function upstreamUrl(request: Request) {
  const incoming = new URL(request.url);
  return new URL(`${incoming.pathname}${incoming.search}`, upstreamOrigin);
}

function forwardedHeaders(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  const incoming = new URL(request.url);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  return headers;
}

function responseHeaders(request: Request, upstream: Response) {
  const headers = new Headers(upstream.headers);
  const location = headers.get("location");
  if (location) {
    const destination = new URL(location, upstreamOrigin);
    if (destination.origin === upstreamOrigin) {
      headers.set(
        "location",
        `${publicOrigin(request)}${destination.pathname}${destination.search}${destination.hash}`,
      );
    }
  }
  return headers;
}

async function proxy(request: Request) {
  const method = request.method.toUpperCase();
  const upstream = await fetch(upstreamUrl(request), {
    method,
    headers: forwardedHeaders(request),
    body: method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });
  const headers = responseHeaders(request, upstream);
  const contentType = headers.get("content-type") || "";
  if (method === "GET" && contentType.includes("text/html")) {
    let html = await upstream.text();
    html = html.includes("</body>")
      ? html.replace("</body>", `${inventoryNavigation}</body>`)
      : `${html}${inventoryNavigation}`;
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("cache-control", "private, no-store, max-age=0");
    return new Response(html, { status: upstream.status, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const dynamic = "force-dynamic";

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
