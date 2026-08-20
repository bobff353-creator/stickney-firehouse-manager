import {
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../../lib/inventory-session";

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  return Response.json(
    {
      authenticated: true,
      user: session.context.user,
      department: session.context.department,
      role: session.context.role,
      grants: session.context.grants,
      expiresAt: session.context.expiresAt,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
      },
    },
  );
}
