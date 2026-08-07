// R2-compatible object storage backed by Supabase Storage.
//
// The photo/attachment routes use a Cloudflare R2 bucket via three methods:
//   bucket.put(key, body, { httpMetadata: { contentType }, customMetadata })
//   bucket.get(key) -> { body: ReadableStream } | null
//   bucket.delete(key)
// This adapter presents that same surface over a Supabase Storage bucket so the
// routes need only swap where they obtain the bucket, not how they call it.
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional: SUPABASE_STORAGE_BUCKET (defaults to "department-files").

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PutBody = ReadableStream | Blob | ArrayBuffer | ArrayBufferView | string;
type PutOptions = { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };

let serviceClient: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/[﻿\r\n]/g, "").trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/[﻿\r\n]/g, "").trim();
  if (!url || !serviceKey) {
    throw new Error("Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  return serviceClient;
}

const bucketName = () => process.env.SUPABASE_STORAGE_BUCKET?.trim() || "department-files";

async function toBlob(body: PutBody, contentType?: string): Promise<Blob> {
  if (body instanceof Blob) return body;
  if (typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return new Blob([body as BlobPart], contentType ? { type: contentType } : undefined);
  }
  // ReadableStream: buffer it via the Response helper (fine for photo-sized files).
  const buffer = await new Response(body as ReadableStream).arrayBuffer();
  return new Blob([buffer], contentType ? { type: contentType } : undefined);
}

export type StoredObject = { body: ReadableStream; arrayBuffer: () => Promise<ArrayBuffer>; httpMetadata: { contentType: string } };

export const serverBucket = {
  async put(key: string, body: PutBody, options: PutOptions = {}): Promise<void> {
    const contentType = options.httpMetadata?.contentType;
    const blob = await toBlob(body, contentType);
    const { error } = await client().storage.from(bucketName()).upload(key, blob, {
      contentType: contentType ?? "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  },

  async get(key: string): Promise<StoredObject | null> {
    const { data, error } = await client().storage.from(bucketName()).download(key);
    if (error || !data) return null;
    return {
      body: data.stream() as unknown as ReadableStream,
      arrayBuffer: () => data.arrayBuffer(),
      httpMetadata: { contentType: data.type || "application/octet-stream" },
    };
  },

  async delete(key: string): Promise<void> {
    await client().storage.from(bucketName()).remove([key]);
  },
};

export type ServerBucket = typeof serverBucket;

/** Returns the storage bucket, or null when storage env is not configured. */
export function getBucket(): ServerBucket | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return serverBucket;
}
