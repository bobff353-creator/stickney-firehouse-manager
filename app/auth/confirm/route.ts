const upstreamOrigin = "https://stickney-payroll-manager.bobff353.chatgpt.site";

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const upstream = new URL("/auth/confirm", upstreamOrigin);
  upstream.search = requestUrl.search;

  const response = await fetch(upstream, {
    headers: {
      accept: request.headers.get("accept") || "text/html",
      cookie: request.headers.get("cookie") || "",
      "user-agent": request.headers.get("user-agent") || "",
      "x-forwarded-host": requestUrl.host,
      "x-forwarded-proto": requestUrl.protocol.replace(":", ""),
    },
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers(response.headers);
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
  return new Response(response.body, { status: response.status, headers });
}
