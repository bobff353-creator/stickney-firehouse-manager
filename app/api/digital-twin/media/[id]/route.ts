import { createInventorySupabaseClient } from "../../../../lib/supabase-server";
import {
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  try {
    const { id } = await params;
    const supabase = await createInventorySupabaseClient();
    const { data: photo, error } = await supabase
      .from("inventory_photo_views")
      .select("object_key,mime_type,original_filename")
      .eq("department_id", session.context.department.id)
      .eq("id", id)
      .is("replaced_at", null)
      .maybeSingle();
    if (error || !photo) {
      return Response.json({ error: "Photo not found." }, { status: 404 });
    }
    const { data, error: downloadError } = await supabase.storage
      .from(mediaBucket)
      .download(photo.object_key);
    if (downloadError || !data) {
      return Response.json({ error: "Photo is unavailable." }, { status: 503 });
    }
    return new Response(data.stream(), {
      headers: {
        "Content-Type": photo.mime_type || data.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${String(photo.original_filename || "apparatus-photo").replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "Photo is unavailable." }, { status: 503 });
  }
}
