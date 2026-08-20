import { getTrainingSites } from "../../lib/external-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTrainingSites();
  return Response.json(data, {
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
