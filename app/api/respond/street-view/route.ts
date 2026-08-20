const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const departmentId = request.headers.get("x-department-id")?.trim();
  if (!email || !departmentId) {
    return Response.json({ error: "Verified department access is required." }, { status: 401, headers: noStoreHeaders });
  }

  const key = process.env.GOOGLE_MAPS_STREET_VIEW_KEY?.trim()
    || process.env["Maps Platform API Key"]?.trim();
  if (!key) {
    return Response.json({ error: "Street View is not configured." }, { status: 503, headers: noStoreHeaders });
  }

  const location = new URL(request.url).searchParams.get("location")?.trim();
  if (!location || location.length > 300) {
    return Response.json({ error: "A valid incident location is required." }, { status: 400, headers: noStoreHeaders });
  }

  const googleUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
  googleUrl.searchParams.set("size", "640x400");
  googleUrl.searchParams.set("location", location);
  googleUrl.searchParams.set("fov", "90");
  googleUrl.searchParams.set("pitch", "0");
  googleUrl.searchParams.set("return_error_code", "true");
  googleUrl.searchParams.set("key", key);

  const requestOrigin = new URL(request.url).origin;
  const browserReferer = request.headers.get("referer");
  let googleReferer = `${requestOrigin}/`;
  if (browserReferer) {
    try {
      const parsedReferer = new URL(browserReferer);
      if (parsedReferer.origin === requestOrigin) googleReferer = browserReferer;
    } catch {
      // Keep the verified request origin when an invalid referrer is supplied.
    }
  }

  const response = await fetch(googleUrl, {
    cache: "no-store",
    headers: {
      Accept: "image/*",
      Referer: googleReferer,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) {
    const upstreamMessage = contentType.startsWith("text/") ? (await response.text()).replaceAll(key, "[redacted]").slice(0, 300) : "";
    console.error("Google Street View request failed", { status: response.status, contentType, message: upstreamMessage || "No image returned" });
    const configurationError = response.status === 401 || response.status === 403;
    return Response.json(
      { error: configurationError ? "Google Street View rejected the configured API key or its restrictions." : "Street View imagery is unavailable for this location." },
      { status: configurationError ? 502 : 404, headers: noStoreHeaders },
    );
  }

  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      ...noStoreHeaders,
      "Content-Type": contentType,
    },
  });
}
