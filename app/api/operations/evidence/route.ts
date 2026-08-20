import { createInventorySupabaseClient } from "../../../lib/supabase-server";
import {
  canMutateInventory,
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";
const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function clean(value: FormDataEntryValue | null, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request) || !canMutateInventory(session.context.role)) {
    return privateJson({ error: "Your department role cannot attach deficiency photos." }, 403);
  }

  const form = await request.formData();
  const photo = form.get("photo");
  const apparatusId = clean(form.get("apparatusId"), 80);
  const checkItemId = clean(form.get("checkItemId"), 80) || null;
  if (!(photo instanceof File) || !apparatusId) {
    return privateJson({ error: "Select an apparatus and attach a photo." }, 400);
  }
  if (!imageTypes.has(photo.type) || photo.size <= 0 || photo.size > 20 * 1024 * 1024) {
    return privateJson(
      { error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image no larger than 20 MB." },
      400,
    );
  }

  const supabase = await createInventorySupabaseClient();
  const departmentId = session.context.department.id;
  const { data: apparatus } = await supabase
    .from("inventory_apparatus_profiles")
    .select("id")
    .eq("department_id", departmentId)
    .eq("id", apparatusId)
    .maybeSingle();
  if (!apparatus) return privateJson({ error: "The selected apparatus was not found." }, 404);

  if (checkItemId) {
    const { data: item } = await supabase
      .from("inventory_check_items")
      .select("id,check_id")
      .eq("department_id", departmentId)
      .eq("id", checkItemId)
      .maybeSingle();
    if (!item) return privateJson({ error: "The inspection item was not found." }, 404);
    const { data: check } = await supabase
      .from("inventory_checks")
      .select("id")
      .eq("department_id", departmentId)
      .eq("apparatus_id", apparatusId)
      .eq("id", item.check_id)
      .maybeSingle();
    if (!check) return privateJson({ error: "The photo must match this apparatus inspection." }, 400);
  }

  const id = crypto.randomUUID();
  const extension = photo.type === "image/png"
    ? "png"
    : photo.type === "image/webp"
      ? "webp"
      : ["image/heic", "image/heif"].includes(photo.type) ? "heic" : "jpg";
  const objectKey = `${departmentId}/${apparatusId}/deficiencies/${id}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(mediaBucket)
    .upload(objectKey, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return privateJson({ error: "The deficiency photo could not be uploaded." }, 503);

  const row = {
    id,
    department_id: departmentId,
    apparatus_id: apparatusId,
    check_item_id: checkItemId,
    object_key: objectKey,
    original_filename: photo.name.slice(0, 240),
    mime_type: photo.type,
    byte_size: photo.size,
    captured_by: session.context.user.email,
  };
  const { error } = await supabase.from("inventory_deficiency_photos").insert(row);
  if (error) {
    await supabase.storage.from(mediaBucket).remove([objectKey]);
    return privateJson({ error: "The deficiency photo record could not be saved." }, 503);
  }
  return privateJson({ photo: { id, url: `/api/operations/evidence/${id}` } }, 201);
}
