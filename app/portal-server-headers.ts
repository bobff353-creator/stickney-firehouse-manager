import "server-only";

// Server-only proof for the SQL/storage boundary. Never return these headers to
// a browser or use this module from a client component.
export function portalServerHeaders(): Record<string, string> {
  const secret = process.env.FIREHOUSE_DATABASE_SECRET?.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!secret) throw new Error("Portal database security is not configured.");
  return { "x-firehouse-server-key": secret };
}
