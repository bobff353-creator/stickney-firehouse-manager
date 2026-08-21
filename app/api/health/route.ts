import { getPublicSupabaseConfig } from "../../supabase-config";

function projectRef(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  const match = hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  return match?.[1] ?? "unrecognized";
}

export async function GET() {
  const { url } = getPublicSupabaseConfig();
  return Response.json({
    application: "stickney-firehouse-manager",
    environment: process.env.VERCEL_ENV || "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    supabaseConfiguration: "configured",
    supabaseProjectRef: projectRef(url),
  }, {
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
