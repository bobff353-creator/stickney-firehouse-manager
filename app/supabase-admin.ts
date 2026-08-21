import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./supabase-config";

function isServerCredential(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown };
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}

export function getSupabaseAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey || !isServerCredential(secretKey)) {
    throw new Error("Secure employee activation is not configured.");
  }
  const { url } = getPublicSupabaseConfig();
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
