import { ensureDatabase } from "../../../../../db/bootstrap";

type BoardBucket = {
  get(key: string): Promise<{ body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
};

async function bucket() {
  const { env } = await import("cloudflare:workers");
  const value = (env as unknown as { BUCKET?: BoardBucket }).BUCKET;
  if (!value) throw new Error("Attachment storage is unavailable");
  return value;
}

export async function GET(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  try {
    const { attachmentId } = await context.params;
    const db = await ensureDatabase();
    const attachment = await db.prepare(
      "SELECT a.object_key AS objectKey, a.filename, a.content_type AS contentType FROM chief_board_attachments a JOIN chief_board_items i ON i.id = a.item_id WHERE a.id = ? LIMIT 1"
    ).bind(attachmentId).first<{ objectKey: string; filename: string; contentType: string }>();
    if (!attachment) return Response.json({ error: "Attachment not found" }, { status: 404 });
    const object = await (await bucket()).get(attachment.objectKey);
    if (!object) return Response.json({ error: "Attachment file not found" }, { status: 404 });
    const inline = attachment.contentType.startsWith("image/") || attachment.contentType === "application/pdf";
    const headers = new Headers({
      "content-type": object.httpMetadata?.contentType || attachment.contentType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${attachment.filename.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Attachment is unavailable" }, { status: 503 });
  }
}
