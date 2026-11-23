import { handle, identity, HttpError } from "@/app/arrival/lib/server";
import { mapRequest } from "@/app/arrival/lib/map-server";
import { mapBounds } from "@/app/arrival/lib/footprint";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await identity(request);
    const { lng, lat, span } = mapRequest(request);
    const url = new URL(
      "https://img.cookcountyil.gov/imagery/rest/services/CookOrtho2025/ImageServer/exportImage",
    );
    url.search = new URLSearchParams({
      bbox: mapBounds(lng, lat, span).join(","),
      bboxSR: "3857",
      imageSR: "3857",
      size: "1000,700",
      format: "jpg",
      f: "image",
    }).toString();
    let r: Response;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok || !r.headers.get("content-type")?.startsWith("image/"))
        throw new Error();
    } catch {
      throw new HttpError(
        503,
        "County aerial imagery is unavailable. Your existing outline remains saved.",
      );
    }
    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type")!,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
