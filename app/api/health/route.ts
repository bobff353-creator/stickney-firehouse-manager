import { getPublicSupabaseConfig } from "../../supabase-config";
import { releaseIdentity } from "../../system-health-model";

function projectRef(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  const match = hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  return match?.[1] ?? "unrecognized";
}

export async function GET() {
  const { url } = getPublicSupabaseConfig();
  return Response.json({
    application: "stickney-firehouse-manager",
    ...releaseIdentity(process.env),
    supabaseConfiguration: "configured",
    supabaseProjectRef: projectRef(url),
  }, {
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
