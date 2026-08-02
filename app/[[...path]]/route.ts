const upstreamOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";

const portalEnhancements =
  '<style id="stickney-mobile-navigation-fix">' +
  '@media(max-width:980px){#mobile-navigation.mobile-nav-panel{' +
  'top:calc(100% + 8px)!important;bottom:auto!important;' +
  'max-height:calc(100dvh - 166px - env(safe-area-inset-bottom))!important;' +
  'overflow-y:auto!important;overscroll-behavior:contain;' +
  '-webkit-overflow-scrolling:touch;scrollbar-gutter:stable}}' +
  '.field-preplans-page.preplan-builder-focused>:not(.preplan-editor){display:none!important}' +
  '.field-preplans-page.preplan-builder-focused{display:block!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor{' +
  'margin:0!important;max-width:none!important;min-height:calc(100dvh - 96px)}' +
  '.preplan-builder-back{display:inline-flex;align-items:center;justify-content:center;' +
  'min-height:42px;margin:0 0 16px;padding:0 16px;border:1px solid #9a3412;' +
  'border-radius:8px;background:#fff7ed;color:#9a3412;font:700 13px/1 system-ui;' +
  'cursor:pointer}.preplan-builder-back:hover{background:#ffedd5}' +
  '</style>' +
  '<script src="/inventory-route.js" defer></script>' +
  '<script src="/training-route.js?v=20260802-2" defer></script>' +
  '<script src="/preplan-route.js?v=20260802-1" defer></script>' +
  '<script src="/fleet-notices.js" defer></script>';

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
  // Node's fetch decodes the upstream body. Forwarding the original encoding
  // or byte length makes browsers try to decode an already-decoded response.
  headers.delete("content-length");
  headers.delete("content-encoding");
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
      ? html.replace("</body>", `${portalEnhancements}</body>`)
      : `${html}${portalEnhancements}`;
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
