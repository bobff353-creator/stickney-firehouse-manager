// Compatibility shim for the former `cloudflare:workers` `env`.
//
// On Cloudflare, `env` exposed both bindings (DB, BUCKET) and secret env vars.
// On Vercel's Node runtime those are `process.env` plus our adapters. This proxy
// preserves every `env.X` call site: `env.DB` -> Turso adapter, `env.BUCKET` ->
// Supabase Storage adapter, anything else -> `process.env.X`.

import { getD1 } from "../db/d1-libsql";
import { getBucket } from "./server-storage";

export const env: Record<string, unknown> = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      if (property === "DB") return getD1();
      if (property === "BUCKET") return getBucket();
      return process.env[property];
    },
    has(_target, property) {
      if (property === "DB" || property === "BUCKET") return true;
      return typeof property === "string" && property in process.env;
    },
  },
);
