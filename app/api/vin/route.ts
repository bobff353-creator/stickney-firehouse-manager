import { canMutateInventory, sameOriginInventoryRequest, sessionFailureResponse, verifyInventoryRequest } from "../../lib/inventory-session";
import { decodeVinWithVpic } from "../../lib/vin-decoder";

function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request) || !canMutateInventory(session.context, "inventory.setup.manage")) {
    return privateJson({ error: "Your department role cannot decode or change apparatus VIN records." }, 403);
  }
  try {
    const body = await request.json() as { vin?: unknown };
    return privateJson({ decoded: await decodeVinWithVpic(body.vin) });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "The VIN could not be decoded." }, 400);
  }
}
