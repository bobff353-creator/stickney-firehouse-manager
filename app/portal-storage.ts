import { getSupabaseServerClient } from "./supabase-server";

const bucketName = "firehouse-portal";

export type PortalStoredObject = {
  body: ReadableStream;
  httpMetadata: { contentType?: string };
};

export type PortalStorage = {
  get(key: string): Promise<PortalStoredObject | null>;
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string } }): Promise<void>;
  delete(key: string): Promise<void>;
};

export function getPortalStorage(): PortalStorage {
  return {
    async get(key) {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.storage.from(bucketName).download(key);
      if (error) {
        if (/not found|does not exist/i.test(error.message)) return null;
        throw new Error(`Portal storage read failed: ${error.message}`);
      }
      return {
        body: data.stream() as ReadableStream,
        httpMetadata: { contentType: data.type || undefined },
      };
    },
    async put(key, value, options) {
      const supabase = await getSupabaseServerClient();
      const bytes = await new Response(value).arrayBuffer();
      const blob = new Blob([bytes], { type: options.httpMetadata.contentType });
      const { error } = await supabase.storage.from(bucketName).upload(key, blob, {
        contentType: options.httpMetadata.contentType,
        upsert: true,
      });
      if (error) throw new Error(`Portal storage upload failed: ${error.message}`);
    },
    async delete(key) {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.storage.from(bucketName).remove([key]);
      if (error) throw new Error(`Portal storage delete failed: ${error.message}`);
    },
  };
}
