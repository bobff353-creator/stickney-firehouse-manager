function clean(value: string | undefined) {
  return value?.replace(/[\uFEFF\r\n]/g, "").trim() ?? "";
}

const sourceProjectHost = "ukpdacqjmhvlhmrwxtcx.supabase.co";

export function getPublicSupabaseConfig() {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!url || !key) {
    throw new Error("Verified account sign-in is not configured.");
  }
  if (new URL(url).hostname === sourceProjectHost) {
    throw new Error("Configure an independent Supabase project for this Firehouse Manager instance.");
  }
  return { url, key };
}
