import { createInventorySupabaseClient } from "../../../../lib/supabase-server";
import { sessionFailureResponse, verifyInventoryRequest } from "../../../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  const { id } = await context.params;
  const supabase = await createInventorySupabaseClient();
  const { data: photo } = await supabase
    .from("inventory_deficiency_photos")
    .select("object_key,mime_type,original_filename")
    .eq("department_id", session.context.department.id)
    .eq("id", id)
    .maybeSingle();
  if (!photo) return Response.json({ error: "Photo not found." }, { status: 404 });
  const { data, error } = await supabase.storage.from(mediaBucket).download(photo.object_key);
  if (error || !data) return Response.json({ error: "Photo unavailable." }, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": photo.mime_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(photo.original_filename)}`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
