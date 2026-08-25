import { createInventorySupabaseClient } from "../../../../lib/supabase-server";
import { sessionFailureResponse, verifyInventoryRequest } from "../../../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  const { id } = await context.params;
  const supabase = await createInventorySupabaseClient();
  const { data: document } = await supabase
    .from("inventory_work_order_documents")
    .select("object_key,mime_type,original_filename")
    .eq("department_id", session.context.department.id)
    .eq("id", id)
    .maybeSingle();
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const { data, error } = await supabase.storage.from(mediaBucket).download(document.object_key);
  if (error || !data) return Response.json({ error: "Document unavailable." }, { status: 404 });
  const inline = document.mime_type === "application/pdf" || document.mime_type.startsWith("image/");
  return new Response(data, {
    headers: {
      "Content-Type": document.mime_type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(document.original_filename)}`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
