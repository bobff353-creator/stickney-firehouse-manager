import { getCloseCallNews } from "../../lib/external-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCloseCallNews();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Close-call refresh failed:", error instanceof Error ? error.message : "Unknown source error");
    return Response.json(
      {
        items: [],
        source: "Firefighter Close Calls",
        sourceUrl: "https://www.firefighterclosecalls.com/",
        stale: true,
        error: "The latest close-call reports are temporarily unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "public, max-age=60" } },
    );
  }
}
