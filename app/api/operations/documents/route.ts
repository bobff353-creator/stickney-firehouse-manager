import { createInventorySupabaseClient } from "../../../lib/supabase-server";
import {
  canMutateInventory,
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";
const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const documentTypes = new Set(["service_ticket", "receipt", "invoice", "photo", "warranty", "inspection", "other"]);

function clean(value: FormDataEntryValue | null, limit = 240) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request) || !canMutateInventory(session.context, "inventory.repairs.manage")) {
    return privateJson({ error: "Repair management permission is required to attach service documents." }, 403);
  }

  const form = await request.formData();
  const file = form.get("file");
  const workOrderId = clean(form.get("workOrderId"), 80);
  const requestedType = clean(form.get("documentType"), 40);
  const documentType = documentTypes.has(requestedType) ? requestedType : "other";
  const note = clean(form.get("note"), 500) || null;
  if (!(file instanceof File) || !workOrderId) return privateJson({ error: "Choose a repair record and a document." }, 400);
  if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
    return privateJson({ error: "Use a PDF, JPEG, PNG, WebP, HEIC, or HEIF file no larger than 20 MB." }, 400);
  }

  const supabase = await createInventorySupabaseClient();
  const departmentId = session.context.department.id;
  const { data: order } = await supabase
    .from("inventory_work_orders")
    .select("id,apparatus_id")
    .eq("department_id", departmentId)
    .eq("id", workOrderId)
    .maybeSingle();
  if (!order) return privateJson({ error: "The selected repair record was not found." }, 404);

  const id = crypto.randomUUID();
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : ["image/heic", "image/heif"].includes(file.type) ? "heic" : "jpg";
  const objectKey = `${departmentId}/${order.apparatus_id}/maintenance/${workOrderId}/${id}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(objectKey, file, { contentType: file.type, upsert: false });
  if (uploadError) return privateJson({ error: "The service document could not be uploaded." }, 503);

  const row = {
    id,
    department_id: departmentId,
    apparatus_id: order.apparatus_id,
    work_order_id: workOrderId,
    document_type: documentType,
    object_key: objectKey,
    original_filename: file.name.slice(0, 240),
    mime_type: file.type,
    byte_size: file.size,
    note,
    uploaded_by: session.context.user.email,
  };
  const { error } = await supabase.from("inventory_work_order_documents").insert(row);
  if (error) {
    await supabase.storage.from(mediaBucket).remove([objectKey]);
    return privateJson({ error: "The service document record could not be saved." }, 503);
  }
  return privateJson({ document: { ...row, url: `/api/operations/documents/${id}` } }, 201);
}
