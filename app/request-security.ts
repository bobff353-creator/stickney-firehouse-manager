/** Cookie-setting sign-in routes must not accept a cross-site form submission. */
export function sameOriginAuthRequest(request: Request) {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url);
  // Next's internal route URL can use localhost after Proxy forwarding. The
  // browser-controlled Host still identifies the site that received the POST;
  // do not trust a caller-supplied X-Forwarded-Host as an alternative origin.
  const host = request.headers.get("host");
  if (host) destination.host = host;
  return origin === destination.origin
    && request.headers.get("sec-fetch-site") !== "cross-site";
}

/** Validate the parsed destination as well as its spelling (backslashes normalize to slashes). */
export function safeReturnPath(value: string | null, origin: string) {
  if (!value?.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    const destination = new URL(value, origin);
    return destination.origin === origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/";
  } catch {
    return "/";
  }
}
