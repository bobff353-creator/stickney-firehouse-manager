export async function GET(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return Response.json(
      { configured: false, provider: "fallback", error: "Authentication required." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "";
  return Response.json(
    apiKey
      ? { configured: true, provider: "google", apiKey }
      : { configured: false, provider: "fallback" },
    { headers: { "cache-control": "no-store" } },
  );
}
