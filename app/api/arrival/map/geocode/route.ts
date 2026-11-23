import { handle, identity, json, HttpError } from "@/app/arrival/lib/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    await identity(request);
    const address =
      new URL(request.url).searchParams.get("address")?.trim() || "";
    if (!address || address.length > 500)
      throw new HttpError(422, "Enter a street address, city and state.");
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.search = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      format: "json",
    }).toString();
    let data: {
      result?: {
        addressMatches?: {
          matchedAddress: string;
          coordinates: { x: number; y: number };
        }[];
      };
    };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error();
      data = await r.json();
    } catch {
      throw new HttpError(
        503,
        "Address search is unavailable. Enter verified coordinates instead, or try again later.",
      );
    }
    return json({
      matches: (data.result?.addressMatches || [])
        .slice(0, 8)
        .map((m) => ({
          address: m.matchedAddress,
          lng: m.coordinates.x,
          lat: m.coordinates.y,
        })),
      source:
        "U.S. Census address-range geocoder — approximate position, not a verified building location",
    });
  });
}
