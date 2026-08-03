const upstreamOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";
const upstreamTimeoutMs = 15_000;

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const upstream = new URL("/auth/confirm", upstreamOrigin);
  upstream.search = requestUrl.search;

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: {
        accept: request.headers.get("accept") || "text/html",
        cookie: request.headers.get("cookie") || "",
        "user-agent": request.headers.get("user-agent") || "",
        "x-forwarded-host": requestUrl.host,
        "x-forwarded-proto": requestUrl.protocol.replace(":", ""),
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch {
    return new Response(
      "Authentication is temporarily unavailable. Return to the portal and try again.",
      {
        status: 503,
        headers: {
          "cache-control": "private, no-store, max-age=0",
          "content-type": "text/plain; charset=utf-8",
          "retry-after": "5",
        },
      },
    );
  }

  const headers = new Headers(response.headers);
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
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  return new Response(response.body, { status: response.status, headers });
}
