import { sameOriginAuthRequest } from "../../../request-security";

/** Old clients must not create a verified account from a known roster number. */
export async function POST(request: Request) {
  if (!sameOriginAuthRequest(request)) {
    return Response.json({ error: "Open activation from the department portal." }, { status: 403 });
  }
  return Response.json({
    error: "Ask a department administrator to send an invitation from Employees. Open the email link to verify your address, then choose your private PIN.",
    code: "VERIFIED_INVITATION_REQUIRED",
  }, { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
