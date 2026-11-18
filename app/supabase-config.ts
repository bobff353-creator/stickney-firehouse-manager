function clean(value: string | undefined) {
  return value?.replace(/[\uFEFF\r\n]/g, "").trim() ?? "";
}

// Reject both the legacy shared project and the current operational Stickney
// project. A separate checkout must never become a second client of either.
const sourceProjectHosts = [
  "ukpdacqjmhvlhmrwxtcx.supabase.co",
  "datqzdndkrfyovhwppuq.supabase.co",
];

export function getPublicSupabaseConfig() {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!url || !key) {
    throw new Error("Verified account sign-in is not configured.");
  }
  const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  if (sourceProjectHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error("Configure an independent Supabase project for this Firehouse Manager instance.");
  }
  return { url, key };
}
