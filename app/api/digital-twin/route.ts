import { createInventorySupabaseClient } from "../../lib/supabase-server";
import {
  canMutateInventory,
  sameOriginInventoryRequest,
  type InventorySessionContext,
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../lib/inventory-session";

const mediaBucket = "stickney-inventory-media";
const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const sides = new Set([
  "driver",
  "officer",
  "front",
  "rear",
  "cab",
  "pump",
  "roof",
  "interior",
  "spin",
]);
const doorStates = new Set(["closed", "open", "not_applicable"]);

function clean(value: unknown, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}

async function audit(
  session: InventorySessionContext,
  action: string,
  aggregateType: string,
  aggregateId: string,
  next: unknown,
  request: Request,
) {
  const supabase = await createInventorySupabaseClient();
  await supabase.from("inventory_audit_events").insert({
    department_id: session.department.id,
    actor_id: session.user.id,
    actor_email: session.user.email,
    action,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    next_json: next,
    source_device: request.headers.get("user-agent")?.slice(0, 300) || null,
  });
}

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  try {
    const supabase = await createInventorySupabaseClient();
    const apparatusId = clean(new URL(request.url).searchParams.get("apparatusId"));
    const { data: apparatus, error: apparatusError } = await supabase
      .from("inventory_apparatus_profiles")
      .select("id,name,asset_type,vin,manufacturer,model,year,created_at")
      .eq("department_id", session.context.department.id)
      .order("name");
    if (apparatusError) throw apparatusError;
    if (!apparatusId) {
      return privateJson({
        configured: true,
        apparatus: apparatus || [],
        compartments: [],
        photos: [],
        hotspots: [],
      });
    }
    if (!(apparatus || []).some((item) => item.id === apparatusId)) {
      return privateJson({ error: "Apparatus not found." }, 404);
    }

    const [compartmentsResult, photosResult, hotspotsResult] = await Promise.all([
      supabase
        .from("inventory_compartments")
        .select("id,apparatus_id,label,side,sort_order")
        .eq("department_id", session.context.department.id)
        .eq("apparatus_id", apparatusId)
        .order("sort_order"),
      supabase
        .from("inventory_photo_views")
        .select("id,apparatus_id,compartment_id,equipment_id,view_key,view_level,door_state,angle_degrees,version_number,approval_status,paired_view_id,captured_at,captured_by,approved_at")
        .eq("department_id", session.context.department.id)
        .eq("apparatus_id", apparatusId)
        .is("replaced_at", null)
        .order("view_key")
        .order("door_state")
        .order("version_number", { ascending: false }),
      supabase
        .from("inventory_photo_hotspots")
        .select("id,photo_view_id,compartment_id,label,x_basis_points,y_basis_points,display_order")
        .eq("department_id", session.context.department.id)
        .eq("apparatus_id", apparatusId)
        .order("display_order"),
    ]);
    if (compartmentsResult.error || photosResult.error || hotspotsResult.error) {
      throw compartmentsResult.error || photosResult.error || hotspotsResult.error;
    }
    return privateJson({
      configured: true,
      apparatus: apparatus || [],
      compartments: compartmentsResult.data || [],
      photos: (photosResult.data || []).map((photo) => ({
        ...photo,
        url: `/api/digital-twin/media/${photo.id}`,
      })),
      hotspots: hotspotsResult.data || [],
    });
  } catch {
    return privateJson(
      { configured: false, error: "Digital-twin storage is not available." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (
    !sameOriginInventoryRequest(request)
    || !canMutateInventory(session.context.role)
  ) {
    return privateJson(
      { error: "Your department role cannot change Inventory records." },
      403,
    );
  }
  const supabase = await createInventorySupabaseClient();
  const departmentId = session.context.department.id;
  const actor = session.context.user.email;
  let requestedAction = "";
  try {
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      requestedAction = "save photo";
      const form = await request.formData();
      const file = form.get("photo");
      const apparatusId = clean(form.get("apparatusId"));
      const compartmentId = clean(form.get("compartmentId")) || null;
      const equipmentId = clean(form.get("equipmentId")) || null;
      const viewKey = clean(form.get("viewKey"));
      const viewLevel = clean(form.get("viewLevel")) || "exterior";
      const doorState = clean(form.get("doorState")) || "not_applicable";
      const angleDegrees = Number(form.get("angleDegrees"));
      if (
        !(file instanceof File)
        || !apparatusId
        || !viewKey
        || !sides.has(viewKey.split("-")[0])
        || !doorStates.has(doorState)
      ) {
        return privateJson(
          { error: "A valid apparatus, view, door state, and photo are required." },
          400,
        );
      }
      if (!imageTypes.has(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
        return privateJson(
          { error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image no larger than 20 MB." },
          400,
        );
      }

      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      if (!apparatus) {
        return privateJson(
          { error: "Create the apparatus record before uploading photographs." },
          404,
        );
      }
      if (compartmentId) {
        const { data: compartment } = await supabase
          .from("inventory_compartments")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", compartmentId)
          .eq("apparatus_id", apparatusId)
          .maybeSingle();
        if (!compartment) {
          return privateJson({ error: "Select a compartment from this apparatus." }, 400);
        }
      }

      const { data: prior } = await supabase
        .from("inventory_photo_views")
        .select("id,version_number")
        .eq("department_id", departmentId)
        .eq("apparatus_id", apparatusId)
        .eq("view_key", viewKey)
        .eq("door_state", doorState)
        .is("replaced_at", null)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const id = crypto.randomUUID();
      const extension = file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : ["image/heic", "image/heif"].includes(file.type) ? "heic" : "jpg";
      const objectKey = `${departmentId}/${apparatusId}/${viewKey}/${doorState}/${id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(mediaBucket)
        .upload(objectKey, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      if (prior?.id) {
        await supabase
          .from("inventory_photo_views")
          .update({ replaced_at: new Date().toISOString() })
          .eq("department_id", departmentId)
          .eq("id", prior.id);
      }
      const record = {
        id,
        department_id: departmentId,
        apparatus_id: apparatusId,
        compartment_id: compartmentId,
        equipment_id: equipmentId,
        view_key: viewKey,
        view_level: viewLevel,
        door_state: doorState,
        angle_degrees: Number.isFinite(angleDegrees) ? Math.round(angleDegrees) : null,
        object_key: objectKey,
        original_filename: file.name.slice(0, 240),
        mime_type: file.type,
        byte_size: file.size,
        version_number: Number(prior?.version_number || 0) + 1,
        approval_status: "pending",
        captured_by: actor,
      };
      const { error: insertError } = await supabase
        .from("inventory_photo_views")
        .insert(record);
      if (insertError) {
        await supabase.storage.from(mediaBucket).remove([objectKey]);
        throw insertError;
      }
      await audit(session.context, "photo.uploaded", "apparatus_photo_view", id, record, request);
      return privateJson({
        photo: {
          ...record,
          captured_at: new Date().toISOString(),
          url: `/api/digital-twin/media/${id}`,
        },
      }, 201);
    }

    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 40);
    requestedAction = action;
    if (action === "create_apparatus") {
      const requestedId = clean(body.id, 80);
      const id = requestedId || crypto.randomUUID();
      const name = clean(body.name);
      const assetType = clean(body.assetType, 80);
      if (!name || !assetType) {
        return privateJson({ error: "Unit name and apparatus type are required." }, 400);
      }
      const { data: canonical } = await supabase
        .from("department_apparatus")
        .select("id")
        .eq("department_id", departmentId)
        .eq("id", id)
        .maybeSingle();
      if (!canonical) {
        const { error: canonicalError } = await supabase.from("department_apparatus").insert({
          id,
          department_id: departmentId,
          unit_name: name,
          unit_type: assetType,
          call_sign: name,
          station: "Stickney Fire Department",
          status: "in_service",
          notes: "",
          created_by: session.context.user.id,
          updated_by: session.context.user.id,
        });
        if (canonicalError) throw canonicalError;
      }
      const profile = {
        id,
        department_id: departmentId,
        name,
        asset_type: assetType,
        vin: clean(body.vin, 40) || null,
        manufacturer: clean(body.manufacturer) || null,
        model: clean(body.model) || null,
        year: Number(body.year) || null,
      };
      const { error } = await supabase.from("inventory_apparatus_profiles").upsert(profile);
      if (error) throw error;
      await audit(session.context, "apparatus.created", "apparatus", id, profile, request);
      return privateJson({ apparatus: profile }, 201);
    }
    if (action === "create_compartment") {
      const id = clean(body.id, 80) || crypto.randomUUID();
      const apparatusId = clean(body.apparatusId);
      const label = clean(body.label);
      const side = clean(body.side, 40);
      if (!apparatusId || !label || !sides.has(side)) {
        return privateJson(
          { error: "Apparatus, compartment label, and valid side are required." },
          400,
        );
      }
      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      if (!apparatus) return privateJson({ error: "Apparatus not found." }, 404);
      const row = {
        id,
        department_id: departmentId,
        apparatus_id: apparatusId,
        label,
        side,
        sort_order: Number(body.sortOrder) || 0,
      };
      const { error } = await supabase.from("inventory_compartments").insert(row);
      if (error) throw error;
      await audit(session.context, "compartment.created", "compartment", id, row, request);
      return privateJson({ compartment: row }, 201);
    }
    if (action === "create_hotspot") {
      const id = crypto.randomUUID();
      const photoViewId = clean(body.photoViewId);
      const compartmentId = clean(body.compartmentId);
      const label = clean(body.label);
      const x = Math.max(0, Math.min(10000, Number(body.xBasisPoints)));
      const y = Math.max(0, Math.min(10000, Number(body.yBasisPoints)));
      if (!photoViewId || !compartmentId || !label || !Number.isFinite(x) || !Number.isFinite(y)) {
        return privateJson(
          { error: "Photo, compartment, label, and coordinates are required." },
          400,
        );
      }
      const [{ data: photo }, { data: compartment }] = await Promise.all([
        supabase
          .from("inventory_photo_views")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", photoViewId)
          .is("replaced_at", null)
          .maybeSingle(),
        supabase
          .from("inventory_compartments")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", compartmentId)
          .maybeSingle(),
      ]);
      if (!photo || !compartment || photo.apparatus_id !== compartment.apparatus_id) {
        return privateJson(
          { error: "Photo and compartment must belong to the same apparatus." },
          400,
        );
      }
      const row = {
        id,
        department_id: departmentId,
        apparatus_id: photo.apparatus_id,
        photo_view_id: photoViewId,
        compartment_id: compartmentId,
        label,
        x_basis_points: Math.round(x),
        y_basis_points: Math.round(y),
        display_order: Number(body.displayOrder) || 0,
        created_by: session.context.user.id,
      };
      const { error } = await supabase.from("inventory_photo_hotspots").insert(row);
      if (error) throw error;
      await audit(session.context, "hotspot.created", "photo_hotspot", id, row, request);
      return privateJson({ hotspot: row }, 201);
    }
    if (action === "approve_photo") {
      const photoId = clean(body.photoId);
      const { error } = await supabase
        .from("inventory_photo_views")
        .update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: session.context.user.id,
        })
        .eq("department_id", departmentId)
        .eq("id", photoId)
        .is("replaced_at", null);
      if (error) throw error;
      await audit(
        session.context,
        "photo.approved",
        "apparatus_photo_view",
        photoId,
        { approvalStatus: "approved" },
        request,
      );
      return privateJson({ approved: true });
    }
    return privateJson({ error: "Unsupported digital-twin action." }, 400);
  } catch (error) {
    const databaseError = error !== null && typeof error === "object"
      ? error as { code?: unknown; message?: unknown }
      : {};
    const code = clean(databaseError.code, 20);
    const detail = clean(databaseError.message, 300).toLowerCase();
    if (code === "23505" || detail.includes("duplicate")) {
      return privateJson({ error: "That saved name or identifier already exists." }, 409);
    }
    if (code === "42501") {
      return privateJson(
        { error: "Your department role cannot save this Inventory record." },
        403,
      );
    }
    if (code === "23503") {
      return privateJson(
        { error: "Save the required apparatus, compartment, or photo first." },
        409,
      );
    }
    if (code === "23514") {
      return privateJson(
        { error: "One of the entered Inventory values is not allowed." },
        400,
      );
    }
    const actionName = requestedAction.replaceAll("_", " ") || "Inventory record";
    return privateJson(
      { error: `${actionName} could not be saved. Please check the fields and try again.` },
      503,
    );
  }
}
