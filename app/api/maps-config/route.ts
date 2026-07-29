type Runtime = {
  "Maps Platform API Key"?: string;
};

export async function GET(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return Response.json(
      { configured: false, provider: "fallback", error: "Authentication required." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Runtime;
    const apiKey = runtime["Maps Platform API Key"]?.trim() ?? "";
    return Response.json(
      apiKey
        ? { configured: true, provider: "google", apiKey }
        : { configured: false, provider: "fallback" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { configured: false, provider: "fallback" },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
