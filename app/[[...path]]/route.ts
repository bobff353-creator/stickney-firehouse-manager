const upstreamOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";
const upstreamTimeoutMs = 15_000;
const maximumProxyBodyBytes = 10 * 1024 * 1024;

const portalHeadEnhancements =
  '<link rel="manifest" href="/manifest.webmanifest">' +
  '<meta name="theme-color" content="#0b2b40">' +
  '<meta name="mobile-web-app-capable" content="yes">' +
  '<meta name="apple-mobile-web-app-capable" content="yes">' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
  '<meta name="apple-mobile-web-app-title" content="Stickney Firehouse">' +
  '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">' +
  '<link rel="icon" type="image/png" sizes="192x192" href="/icons/pwa-192.png">';

const portalEnhancements =
  '<style id="stickney-mobile-navigation-fix">' +
  '@media(max-width:980px){#mobile-navigation.mobile-nav-panel{' +
  'top:calc(100% + 8px)!important;bottom:auto!important;' +
  'max-height:calc(100dvh - 166px - env(safe-area-inset-bottom))!important;' +
  'overflow-y:auto!important;overscroll-behavior:contain;' +
  '-webkit-overflow-scrolling:touch;scrollbar-gutter:stable}}' +
  '@media(max-width:980px){.employee-page{grid-template-columns:minmax(0,1fr)!important}' +
  '.employee-page>*{min-width:0!important;max-width:100%!important}' +
  '.employee-page .table-wrap{width:100%!important;max-width:100%!important}' +
  '.employee-page .standard-page-header{flex-wrap:wrap!important}}' +
  'main.app-shell:has(.icb-page)>nav.mobile-bottom-tabs,' +
  'main.app-shell:has(.icb-page) button[aria-label="Open navigation"]{display:none!important}' +
  '.field-preplans-page.preplan-builder-focused>:not(.field-map-layout):not(.preplan-editor){display:none!important}' +
  '.field-preplans-page.preplan-builder-focused{' +
  'display:grid!important;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);' +
  'gap:18px;align-items:start;padding:18px!important}' +
  '.field-preplans-page.preplan-builder-focused>.field-map-layout{' +
  'display:block!important;position:sticky;top:86px;min-width:0}' +
  '.field-preplans-page.preplan-builder-focused>.field-map-layout>aside{display:none!important}' +
  '.field-preplans-page.preplan-builder-focused .field-map{' +
  'height:calc(100dvh - 120px)!important;min-height:520px!important;border-radius:10px}' +
  '.field-preplans-page.preplan-builder-focused .capture-instruction{display:none!important}' +
  '.field-preplans-page.preplan-builder-focused .field-map.capture .google-map-base{' +
  'display:block!important}' +
  '.field-preplans-page.preplan-builder-focused .field-map.capture>.map-credit{' +
  'display:none!important}' +
  '.preplan-map-location-control{position:absolute;top:14px;left:14px;z-index:6;display:flex;' +
  'align-items:center;gap:10px;max-width:calc(100% - 28px);padding:8px;border-radius:10px;' +
  'background:rgba(255,255,255,.94);box-shadow:0 4px 16px rgba(15,23,42,.24);color:#334155}' +
  '.preplan-map-location-control button{min-height:36px;padding:0 12px;border:1px solid #0f4c5c;' +
  'border-radius:7px;background:#0f4c5c;color:#fff;font:750 12px/1 system-ui;cursor:pointer}' +
  '.preplan-map-location-control span{font:700 11px/1.25 system-ui}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor{' +
  'margin:0!important;max-width:none!important;min-width:0;height:calc(100dvh - 120px);' +
  'min-height:520px;overflow-y:auto;scroll-margin-top:86px}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor>header{' +
  'display:grid!important;grid-template-columns:1fr!important;gap:10px!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor>header>div:nth-child(2){' +
  'display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor>header button{' +
  'min-width:0!important;padding-inline:8px!important;white-space:normal!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-quick-grid{display:block!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-quick-grid>article{' +
  'width:100%!important;max-width:none!important;box-sizing:border-box}' +
  '.preplan-builder-back{display:inline-flex;align-items:center;justify-content:center;' +
  'min-height:42px;margin:0 0 16px;padding:0 16px;border:1px solid #9a3412;' +
  'border-radius:8px;background:#fff7ed;color:#9a3412;font:700 13px/1 system-ui;' +
  'cursor:pointer}.preplan-builder-back:hover{background:#ffedd5}' +
  '.preplan-step-selector{display:grid;position:sticky;top:0;z-index:5;' +
  'grid-template-columns:repeat(3,minmax(0,1fr));' +
  'gap:8px;margin:0 0 14px;padding:8px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc}' +
  '.preplan-step-button{display:flex;min-width:0;min-height:58px;flex-direction:column;' +
  'align-items:flex-start;justify-content:center;gap:4px;padding:8px 10px;border:1px solid #cbd5e1;' +
  'border-radius:8px;background:#fff;color:#334155;cursor:pointer;text-align:left}' +
  '.preplan-step-button strong{display:grid;width:24px;height:24px;place-items:center;border-radius:999px;' +
  'background:#e2e8f0;font:800 13px/1 system-ui}.preplan-step-button span{overflow:hidden;' +
  'max-width:100%;font:700 11px/1.15 system-ui;text-overflow:ellipsis;white-space:nowrap}' +
  '.preplan-step-button[aria-selected="true"]{border-color:#0f4c5c;background:#e6f4f1;color:#0f4c5c;' +
  'box-shadow:0 0 0 2px rgba(15,76,92,.12)}' +
  '.preplan-step-button[aria-selected="true"] strong{background:#0f4c5c;color:#fff}' +
  '.field-preplans-page.preplan-builder-focused .preplan-quick-grid>article{display:none!important}' +
  '.field-preplans-page.preplan-builder-focused[data-preplan-active-step="1"] .preplan-quick-grid>article:nth-child(1),' +
  '.field-preplans-page.preplan-builder-focused[data-preplan-active-step="2"] .preplan-quick-grid>article:nth-child(2),' +
  '.field-preplans-page.preplan-builder-focused[data-preplan-active-step="3"] .preplan-quick-grid>article:nth-child(3){display:block!important}' +
  '@media(max-width:760px){.field-preplans-page.preplan-builder-focused{' +
  'grid-template-columns:1fr!important;padding:10px!important}' +
  '.field-preplans-page.preplan-builder-focused>.field-map-layout{position:relative;top:auto}' +
  '.field-preplans-page.preplan-builder-focused .field-map{height:55dvh!important;min-height:360px!important}' +
  '.field-preplans-page.preplan-builder-focused .preplan-editor{' +
  'height:auto;min-height:0;overflow:visible;scroll-margin-top:76px}}' +
  '</style>' +
  '<script src="/inventory-route.js" defer></script>' +
  '<script src="/training-route.js?v=20260802-2" defer></script>' +
  '<script src="/preplan-route.js?v=20260802-6" defer></script>' +
  '<script src="/fleet-notices.js" defer></script>' +
  '<script src="/pwa-register.js" defer></script>';

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
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set(
    "permissions-policy",
    "camera=(self), geolocation=(self), microphone=()",
  );
  return headers;
}

function portalUnavailableResponse(request: Request) {
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (!acceptsHtml) {
    return Response.json(
      { error: "The department portal is temporarily unavailable. Please retry." },
      { status: 503, headers: { "cache-control": "private, no-store, max-age=0" } },
    );
  }
  return new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="theme-color" content="#0b2b40"><title>Portal temporarily unavailable</title>' +
      '<body style="margin:0;background:#eef3f5;color:#102a3a;font-family:system-ui,sans-serif">' +
      '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box">' +
      '<section style="max-width:560px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:28px;box-shadow:0 16px 40px #0b2b4020">' +
      '<p style="margin:0 0 8px;color:#b42318;font-weight:800;letter-spacing:.08em">STICKNEY FIRE DEPARTMENT</p>' +
      '<h1 style="margin:0 0 12px">The operations portal is temporarily unavailable</h1>' +
      '<p style="line-height:1.55">Your request was stopped safely because the portal did not respond in time. No form was submitted twice.</p>' +
      '<button onclick="location.reload()" style="min-height:44px;padding:0 18px;border:0;border-radius:8px;background:#0b2b40;color:#fff;font-weight:800;cursor:pointer">Try again</button>' +
      '</section></main></body></html>',
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store, max-age=0",
        "retry-after": "5",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-frame-options": "SAMEORIGIN",
      },
    },
  );
}

async function proxy(request: Request) {
  const method = request.method.toUpperCase();
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumProxyBodyBytes) {
    return new Response("Request body is too large.", { status: 413 });
  }
  let requestBody: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    requestBody = await request.arrayBuffer();
    if (requestBody.byteLength > maximumProxyBodyBytes) {
      return new Response("Request body is too large.", { status: 413 });
    }
  }
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl(request), {
      method,
      headers: forwardedHeaders(request),
      body: requestBody,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch {
    return portalUnavailableResponse(request);
  }
  const headers = responseHeaders(request, upstream);
  const contentType = headers.get("content-type") || "";
  if (method === "GET" && contentType.includes("text/html")) {
    let html = await upstream.text();
    html = html.includes("</head>")
      ? html.replace("</head>", `${portalHeadEnhancements}</head>`)
      : `${portalHeadEnhancements}${html}`;
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
