function clean(value: string | undefined) {
  return value?.replace(/[\uFEFF\r\n]/g, "").trim() ?? "";
}

// These are Supabase's browser-safe project coordinates. Sites also keeps the
// same values as runtime variables for server requests, while these fallbacks
// ensure the client bundle can initialize after it is served through Vercel.
const PUBLIC_SUPABASE_URL = "https://ukpdacqjmhvlhmrwxtcx.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HY1UlYHvPnvDIuq_N_X_Sg_xu7bxTzs";

export function getPublicSupabaseConfig() {
  const url =
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || PUBLIC_SUPABASE_URL;
  const key = clean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ) || PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Verified account sign-in is not configured.");
  }
  return { url, key };
}
