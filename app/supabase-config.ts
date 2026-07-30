function clean(value: string | undefined) {
  return value?.replace(/[\uFEFF\r\n]/g, "").trim() ?? "";
}

export function getPublicSupabaseConfig() {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!url || !key) {
    throw new Error("Verified account sign-in is not configured.");
  }
  return { url, key };
}
