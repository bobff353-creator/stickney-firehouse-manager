import { createInventorySupabaseClient } from "../../lib/supabase-server";
import {
  canMutateInventory,
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../lib/inventory-session";

function clean(value: unknown, limit = 240) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function stringList(value: unknown, allowed?: Set<string>, limit = 25) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => clean(item, 160))
    .filter((item) => item && (!allowed || allowed.has(item))))]
    .slice(0, limit);
}

const checkTypes = new Set(["daily", "weekly", "inventory", "air_pack"]);
const issueCategories = new Set(["vehicle", "air_pack", "equipment"]);

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

const pageSize = 1000;

async function collectPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const data: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { data, error: page.error };
    const rows = page.data || [];
    data.push(...rows);
    if (rows.length < pageSize) return { data, error: null };
  }
}

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  try {
    const supabase = await createInventorySupabaseClient();
    const departmentId = session.context.department.id;
    const [
      apparatusResult,
      fleetResult,
      compartmentsResult,
      equipmentResult,
      checksResult,
      checkItemsResult,
      exceptionsResult,
      workOrdersResult,
      stockItemsResult,
      stockLotsResult,
      restockRequestsResult,
      equipmentPhotosResult,
    ] = await Promise.all([
      supabase
        .from("inventory_apparatus_profiles")
        .select("id,name,asset_type,weekly_due_day")
        .eq("department_id", departmentId)
        .order("name"),
      supabase
        .from("department_apparatus")
        .select("id,status")
        .eq("department_id", departmentId),
      supabase
        .from("inventory_compartments")
        .select("id,apparatus_id,label,side,sort_order")
        .eq("department_id", departmentId)
        .order("sort_order"),
      collectPages((from, to) => supabase
        .from("inventory_equipment")
        .select("id,apparatus_id,compartment_id,name,manufacturer,model,serial_number,barcode,quantity_required,equipment_category,check_types,source_form,item_order,retired_at")
        .eq("department_id", departmentId)
        .order("item_order")
        .order("name")
        .range(from, to)),
      supabase
        .from("inventory_checks")
        .select("id,apparatus_id,shift_id,check_type,status,started_by,started_at,completed_at")
        .eq("department_id", departmentId)
        .in("status", ["in_progress", "completed"])
        .order("started_at", { ascending: false }),
      collectPages((from, to) => supabase
        .from("inventory_check_items")
        .select("id,check_id,equipment_id,result,notes,numeric_reading,checked_by,checked_at")
        .eq("department_id", departmentId)
        .range(from, to)),
      supabase
        .from("inventory_readiness_exceptions")
        .select("id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,opened_at,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id,resolved_at,resolved_by,resolution_notes")
        .eq("department_id", departmentId)
        .neq("status", "resolved")
        .order("opened_at", { ascending: false }),
      supabase
        .from("inventory_work_orders")
        .select("id,apparatus_id,equipment_id,status,priority,summary,details,assigned_to,opened_by,opened_at,due_at,closed_at,linked_exception_id,assigned_employee_ids,assigned_employee_names,repair_date,repair_cost,vendor,invoice_number,resolution_notes,closed_by")
        .eq("department_id", departmentId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("inventory_stock_items")
        .select("id,name,sku,barcode,unit,par_level,reorder_point,expiration_tracked")
        .eq("department_id", departmentId)
        .order("name"),
      supabase
        .from("inventory_stock_lots")
        .select("id,stock_item_id,location_type,location_id,lot_number,expires_at,quantity_on_hand")
        .eq("department_id", departmentId),
      supabase
        .from("inventory_transactions")
        .select("id,stock_item_id,transaction_type,quantity,reason,performed_by,performed_at")
        .eq("department_id", departmentId)
        .in("transaction_type", ["restock_requested", "restock_approved", "restock_fulfilled"])
        .order("performed_at", { ascending: false }),
      supabase
        .from("inventory_photo_views")
        .select("id,equipment_id,captured_at")
        .eq("department_id", departmentId)
        .not("equipment_id", "is", null)
        .is("replaced_at", null)
        .order("captured_at", { ascending: false }),
    ]);
    const firstError = [
      apparatusResult,
      fleetResult,
      compartmentsResult,
      equipmentResult,
      checksResult,
      checkItemsResult,
      exceptionsResult,
      workOrdersResult,
      stockItemsResult,
      stockLotsResult,
      restockRequestsResult,
      equipmentPhotosResult,
    ].find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const fleetStatuses = new Map(
      (fleetResult.data || []).map((item) => [item.id, item.status]),
    );
    const apparatus = (apparatusResult.data || []).map((item) => ({
      ...item,
      status: fleetStatuses.get(item.id) || "not_recorded",
    }));
    const compartments = compartmentsResult.data || [];
    const allEquipment = (equipmentResult.data || []).map((item) => ({
      ...item,
      compartment_label: compartments.find((row) => row.id === item.compartment_id)?.label || "",
      photo_url: equipmentPhotosResult.data?.find((photo) => photo.equipment_id === item.id)
        ? `/api/digital-twin/media/${equipmentPhotosResult.data.find((photo) => photo.equipment_id === item.id)?.id}`
        : null,
    }));
    const equipment = allEquipment.filter((item) => !item.retired_at);
    const checks = (checksResult.data || []).map((check) => ({
      ...check,
      apparatus_name: apparatus.find((row) => row.id === check.apparatus_id)?.name || "",
      apparatus_status: apparatus.find((row) => row.id === check.apparatus_id)?.status || "not_recorded",
    }));
    const checkItems = (checkItemsResult.data || []).map((item) => {
      const equipmentItem = allEquipment.find((row) => row.id === item.equipment_id);
      return {
        ...item,
        equipment_name: equipmentItem?.name || "",
        compartment_label: equipmentItem?.compartment_label || "",
        quantity_required: equipmentItem?.quantity_required || 1,
        source_form: equipmentItem?.source_form || null,
      };
    });
    const exceptions = (exceptionsResult.data || []).map((item) => ({
      ...item,
      apparatus_name: apparatus.find((row) => row.id === item.apparatus_id)?.name || "",
      apparatus_status: apparatus.find((row) => row.id === item.apparatus_id)?.status || "not_recorded",
      equipment_name: equipment.find((row) => row.id === item.equipment_id)?.name || "",
    }));
    const workOrders = (workOrdersResult.data || []).map((item) => ({
      ...item,
      apparatus_name: apparatus.find((row) => row.id === item.apparatus_id)?.name || "",
      apparatus_status: apparatus.find((row) => row.id === item.apparatus_id)?.status || "not_recorded",
      equipment_name: equipment.find((row) => row.id === item.equipment_id)?.name || "",
    }));
    const lots = stockLotsResult.data || [];
    const stock = (stockItemsResult.data || []).flatMap((item) => {
      const itemLots = lots.filter((lot) => lot.stock_item_id === item.id);
      return itemLots.length
        ? itemLots.map((lot) => ({
          ...item,
          lot_id: lot.id,
          location_type: lot.location_type,
          location_id: lot.location_id,
          lot_number: lot.lot_number,
          expires_at: lot.expires_at,
          quantity_on_hand: lot.quantity_on_hand,
        }))
        : [{
          ...item,
          lot_id: null,
          location_type: null,
          location_id: null,
          lot_number: null,
          expires_at: null,
          quantity_on_hand: 0,
        }];
    });
    const restockRequests = (restockRequestsResult.data || []).map((request) => ({
      ...request,
      stock_item_name: (stockItemsResult.data || []).find((item) => item.id === request.stock_item_id)?.name || "Supply",
      unit: (stockItemsResult.data || []).find((item) => item.id === request.stock_item_id)?.unit || "units",
    }));
    return privateJson({
      configured: true,
      apparatus,
      compartments,
      equipment,
      checks,
      checkItems,
      exceptions,
      workOrders,
      stock,
      restockRequests,
      viewer: {
        email: session.context.user.email,
        role: session.context.role,
      },
    });
  } catch {
    return privateJson(
      { configured: false, error: "Operational inventory records are unavailable." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request)) {
    return privateJson(
      { error: "The Inventory change could not be verified." },
      403,
    );
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 60);
    const requiredPermission = ["start_check", "record_check_item", "complete_check", "adjust_stock", "request_restock"].includes(action)
      ? "inventory.check" as const
      : ["create_notice", "create_work_order", "close_work_order", "update_work_order_status"].includes(action)
        ? "inventory.repairs.manage" as const
        : "inventory.setup.manage" as const;
    if (!canMutateInventory(session.context, requiredPermission)) {
      return privateJson({ error: "Your Inventory permission does not allow this change." }, 403);
    }
    const departmentId = session.context.department.id;
    const actorId = session.context.user.id;
    const actor = session.context.user.email;
    const supabase = await createInventorySupabaseClient();

    if (action === "create_equipment") {
      const compartmentId = clean(body.compartmentId, 80);
      const name = clean(body.name);
      const { data: compartment } = await supabase
        .from("inventory_compartments")
        .select("id,apparatus_id")
        .eq("department_id", departmentId)
        .eq("id", compartmentId)
        .maybeSingle();
      if (!compartment || !name) {
        return privateJson(
          { error: "A saved compartment and equipment name are required." },
          400,
        );
      }
      const record = {
        id: crypto.randomUUID(),
        department_id: departmentId,
        apparatus_id: compartment.apparatus_id,
        compartment_id: compartmentId,
        name,
        manufacturer: clean(body.manufacturer) || null,
        model: clean(body.model) || null,
        serial_number: clean(body.serialNumber, 120) || null,
        barcode: clean(body.barcode, 120) || null,
        quantity_required: Math.max(1, number(body.quantityRequired, 1)),
        equipment_category: issueCategories.has(clean(body.equipmentCategory, 40))
          ? clean(body.equipmentCategory, 40)
          : "equipment",
        check_types: stringList(body.checkTypes, checkTypes, 4).length
          ? stringList(body.checkTypes, checkTypes, 4)
          : ["inventory"],
      };
      const { error } = await supabase.from("inventory_equipment").insert(record);
      if (error) throw error;
      return privateJson({ equipment: record }, 201);
    }

    if (action === "update_equipment") {
      const equipmentId = clean(body.equipmentId, 80);
      const compartmentId = clean(body.compartmentId, 80);
      const name = clean(body.name);
      const [{ data: equipment }, { data: compartment }] = await Promise.all([
        supabase
          .from("inventory_equipment")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", equipmentId)
          .is("retired_at", null)
          .maybeSingle(),
        supabase
          .from("inventory_compartments")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", compartmentId)
          .maybeSingle(),
      ]);
      if (!equipment || !compartment || equipment.apparatus_id !== compartment.apparatus_id || !name) {
        return privateJson({ error: "Choose a saved item, its apparatus compartment, and a name." }, 400);
      }
      const changes = {
        compartment_id: compartmentId,
        name,
        manufacturer: clean(body.manufacturer) || null,
        model: clean(body.model) || null,
        serial_number: clean(body.serialNumber, 120) || null,
        barcode: clean(body.barcode, 120) || null,
        quantity_required: Math.max(1, number(body.quantityRequired, 1)),
        equipment_category: issueCategories.has(clean(body.equipmentCategory, 40))
          ? clean(body.equipmentCategory, 40)
          : "equipment",
        check_types: stringList(body.checkTypes, checkTypes, 4).length
          ? stringList(body.checkTypes, checkTypes, 4)
          : ["inventory"],
      };
      const { error } = await supabase
        .from("inventory_equipment")
        .update(changes)
        .eq("department_id", departmentId)
        .eq("id", equipmentId);
      if (error) throw error;
      return privateJson({ equipment: { id: equipmentId, ...changes } });
    }

    if (action === "start_check") {
      const apparatusId = clean(body.apparatusId, 80);
      const checkType = clean(body.checkType, 40);
      if (!checkTypes.has(checkType)) {
        return privateJson({ error: "Choose Daily, Weekly, Inventory, or Air Pack check." }, 400);
      }
      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      const { data: equipment } = await supabase
        .from("inventory_equipment")
        .select("id,check_types")
        .eq("department_id", departmentId)
        .eq("apparatus_id", apparatusId)
        .is("retired_at", null);
      if (!apparatus) {
        return privateJson({ error: "Select a saved department apparatus." }, 400);
      }
      const { data: existingCheck } = await supabase
        .from("inventory_checks")
        .select("id")
        .eq("department_id", departmentId)
        .eq("apparatus_id", apparatusId)
        .eq("check_type", checkType)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCheck) {
        return privateJson({ checkId: existingCheck.id, resumed: true });
      }
      const includedEquipment = (equipment || []).filter((item) => (
        Array.isArray(item.check_types) && item.check_types.includes(checkType)
      ));
      if (!includedEquipment.length) {
        return privateJson(
          { error: `Add at least one item to the ${checkType.replace("_", " ")} check before starting it.` },
          400,
        );
      }
      const checkId = crypto.randomUUID();
      const { error: checkError } = await supabase.from("inventory_checks").insert({
        id: checkId,
        department_id: departmentId,
        apparatus_id: apparatusId,
        shift_id: clean(body.shiftId, 80) || null,
        check_type: checkType,
        status: "in_progress",
        started_by: actor,
      });
      if (checkError?.code === "23505") {
        const { data: concurrentCheck } = await supabase
          .from("inventory_checks")
          .select("id")
          .eq("department_id", departmentId)
          .eq("apparatus_id", apparatusId)
          .eq("check_type", checkType)
          .eq("status", "in_progress")
          .maybeSingle();
        if (concurrentCheck) {
          return privateJson({ checkId: concurrentCheck.id, resumed: true });
        }
      }
      if (checkError) throw checkError;
      const { error: itemError } = await supabase.from("inventory_check_items").insert(
        includedEquipment.map((item) => ({
          id: crypto.randomUUID(),
          department_id: departmentId,
          check_id: checkId,
          equipment_id: item.id,
          result: "pending",
        })),
      );
      if (itemError) throw itemError;
      return privateJson({ checkId }, 201);
    }

    if (action === "record_check_item") {
      const checkItemId = clean(body.checkItemId, 80);
      const result = clean(body.result, 40);
      if (!["pass", "failed", "missing", "damaged", "not_applicable"].includes(result)) {
        return privateJson(
          { error: "Choose Pass, Failed, Missing, Damaged, or Not applicable." },
          400,
        );
      }
      const { data: item } = await supabase
        .from("inventory_check_items")
        .select("id,check_id,equipment_id")
        .eq("department_id", departmentId)
        .eq("id", checkItemId)
        .maybeSingle();
      if (!item) return privateJson({ error: "This check item was not found." }, 404);
      const [{ data: check }, { data: equipment }] = await Promise.all([
        supabase
          .from("inventory_checks")
          .select("id,apparatus_id,status,check_type")
          .eq("department_id", departmentId)
          .eq("id", item.check_id)
          .eq("status", "in_progress")
          .maybeSingle(),
        supabase
          .from("inventory_equipment")
          .select("id,name,equipment_category")
          .eq("department_id", departmentId)
          .eq("id", item.equipment_id)
          .maybeSingle(),
      ]);
      if (!check || !equipment) {
        return privateJson({ error: "This active check item was not found." }, 404);
      }
      const notes = clean(body.notes, 500) || null;
      const equipmentName = clean(equipment.name, 300);
      const isNumericReadingItem = /\b(mileage|odometer)\b/i.test(equipmentName);
      const numericReadingInput = body.numericReading;
      const numericReading = numericReadingInput === null || numericReadingInput === undefined || numericReadingInput === ""
        ? null
        : Number(numericReadingInput);
      if (isNumericReadingItem && (numericReading === null || !Number.isFinite(numericReading) || numericReading < 0)) {
        return privateJson(
          { error: "Enter the current mileage or odometer reading before saving this item." },
          400,
        );
      }
      if (isNumericReadingItem && result !== "pass") {
        return privateJson({ error: "Mileage and odometer items must be saved as a numeric reading." }, 400);
      }
      const evidencePhotoId = clean(body.evidencePhotoId, 80) || null;
      const assignedEmployeeIds = stringList(body.assignedEmployeeIds);
      const assignedEmployeeNames = stringList(body.assignedEmployeeNames);
      const categories = stringList(body.issueCategories, issueCategories, 3);
      const isFailure = ["failed", "missing", "damaged"].includes(result);
      if (isFailure && (!notes || !evidencePhotoId)) {
        return privateJson(
          { error: "A failed item requires a note and attached photo." },
          400,
        );
      }
      if (evidencePhotoId) {
        const { data: evidence } = await supabase
          .from("inventory_deficiency_photos")
          .select("id")
          .eq("department_id", departmentId)
          .eq("apparatus_id", check.apparatus_id)
          .eq("check_item_id", checkItemId)
          .eq("id", evidencePhotoId)
          .maybeSingle();
        if (!evidence) return privateJson({ error: "The attached photo does not match this item." }, 400);
      }
      const { error } = await supabase
        .from("inventory_check_items")
        .update({
          result,
          notes,
          numeric_reading: isNumericReadingItem ? numericReading : null,
          checked_by: actor,
          checked_at: new Date().toISOString(),
        })
        .eq("department_id", departmentId)
        .eq("id", checkItemId);
      if (error) throw error;
      if (isFailure) {
        const { data: existing } = await supabase
          .from("inventory_readiness_exceptions")
          .select("id")
          .eq("department_id", departmentId)
          .eq("check_item_id", checkItemId)
          .neq("status", "resolved")
          .maybeSingle();
        const exceptionId = existing?.id || crypto.randomUUID();
        const exceptionRecord = {
          result,
          priority: result === "missing" ? "high" : "medium",
          notes,
          status: "open",
          issue_categories: categories.length
            ? categories
            : [equipment.equipment_category || (check.check_type === "air_pack" ? "air_pack" : "equipment")],
          assigned_employee_ids: assignedEmployeeIds,
          assigned_employee_names: assignedEmployeeNames,
          evidence_photo_id: evidencePhotoId,
        };
        if (!existing) {
          const { error: exceptionError } = await supabase
            .from("inventory_readiness_exceptions")
            .insert({
              id: exceptionId,
              department_id: departmentId,
              apparatus_id: check.apparatus_id,
              equipment_id: item.equipment_id,
              check_item_id: checkItemId,
              ...exceptionRecord,
              out_of_service: false,
              opened_by: actor,
            });
          if (exceptionError) throw exceptionError;
        } else {
          const { error: exceptionError } = await supabase
            .from("inventory_readiness_exceptions")
            .update(exceptionRecord)
            .eq("department_id", departmentId)
            .eq("id", exceptionId);
          if (exceptionError) throw exceptionError;
        }
        const { data: linkedOrder } = await supabase
          .from("inventory_work_orders")
          .select("id")
          .eq("department_id", departmentId)
          .eq("linked_exception_id", exceptionId)
          .neq("status", "closed")
          .maybeSingle();
        if (!linkedOrder) {
          const { error: orderError } = await supabase.from("inventory_work_orders").insert({
            id: crypto.randomUUID(),
            department_id: departmentId,
            apparatus_id: check.apparatus_id,
            equipment_id: item.equipment_id,
            linked_exception_id: exceptionId,
            status: "new",
            priority: exceptionRecord.priority,
            summary: `${equipment.name} failed ${String(check.check_type).replace("_", " ")} check`,
            details: notes,
            assigned_to: assignedEmployeeNames.join(", ") || null,
            assigned_employee_ids: assignedEmployeeIds,
            assigned_employee_names: assignedEmployeeNames,
            opened_by: actor,
          });
          if (orderError) throw orderError;
        }
      }
      return privateJson({ saved: true });
    }

    if (action === "complete_check") {
      const checkId = clean(body.checkId, 80);
      const { count } = await supabase
        .from("inventory_check_items")
        .select("id", { count: "exact", head: true })
        .eq("department_id", departmentId)
        .eq("check_id", checkId)
        .eq("result", "pending");
      if (Number(count || 0) > 0) {
        return privateJson(
          { error: "Record every equipment item before completing the check." },
          409,
        );
      }
      const { error } = await supabase
        .from("inventory_checks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("department_id", departmentId)
        .eq("id", checkId)
        .eq("status", "in_progress");
      if (error) throw error;
      return privateJson({ completed: true });
    }

    if (action === "create_notice") {
      const apparatusId = clean(body.apparatusId, 80);
      const notes = clean(body.notes, 1000);
      const categories = stringList(body.issueCategories, issueCategories, 3);
      const assignedEmployeeIds = stringList(body.assignedEmployeeIds);
      const assignedEmployeeNames = stringList(body.assignedEmployeeNames);
      const evidencePhotoId = clean(body.evidencePhotoId, 80) || null;
      if (!apparatusId || !notes || !categories.length || !assignedEmployeeIds.length) {
        return privateJson(
          { error: "Select an apparatus, issue type, employee, and enter the notice details." },
          400,
        );
      }
      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id,name")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      if (!apparatus) return privateJson({ error: "The selected apparatus was not found." }, 404);
      if (evidencePhotoId) {
        const { data: evidence } = await supabase
          .from("inventory_deficiency_photos")
          .select("id")
          .eq("department_id", departmentId)
          .eq("apparatus_id", apparatusId)
          .eq("id", evidencePhotoId)
          .maybeSingle();
        if (!evidence) return privateJson({ error: "The attached photo does not match this apparatus." }, 400);
      }
      const exceptionId = crypto.randomUUID();
      const { error: exceptionError } = await supabase
        .from("inventory_readiness_exceptions")
        .insert({
          id: exceptionId,
          department_id: departmentId,
          apparatus_id: apparatusId,
          result: "failed",
          priority: clean(body.priority, 40) || "medium",
          notes,
          status: "open",
          out_of_service: false,
          opened_by: actor,
          issue_categories: categories,
          assigned_employee_ids: assignedEmployeeIds,
          assigned_employee_names: assignedEmployeeNames,
          evidence_photo_id: evidencePhotoId,
        });
      if (exceptionError) throw exceptionError;
      const { error: orderError } = await supabase.from("inventory_work_orders").insert({
        id: crypto.randomUUID(),
        department_id: departmentId,
        apparatus_id: apparatusId,
        linked_exception_id: exceptionId,
        status: "new",
        priority: clean(body.priority, 40) || "medium",
        summary: `${apparatus.name} ${categories.map((item) => item.replace("_", " ")).join(" / ")} notice`,
        details: notes,
        assigned_to: assignedEmployeeNames.join(", "),
        assigned_employee_ids: assignedEmployeeIds,
        assigned_employee_names: assignedEmployeeNames,
        opened_by: actor,
      });
      if (orderError) throw orderError;
      return privateJson({ noticeId: exceptionId }, 201);
    }

    if (action === "create_work_order") {
      const apparatusId = clean(body.apparatusId, 80);
      const summary = clean(body.summary);
      if (!apparatusId || !summary) {
        return privateJson(
          { error: "Select an apparatus and describe the work needed." },
          400,
        );
      }
      const record = {
        id: crypto.randomUUID(),
        department_id: departmentId,
        apparatus_id: apparatusId,
        status: "new",
        priority: clean(body.priority, 40) || "routine",
        summary,
        details: clean(body.details, 1000) || null,
        assigned_to: stringList(body.assignedEmployeeNames).join(", ")
          || clean(body.assignedTo, 160)
          || null,
        assigned_employee_ids: stringList(body.assignedEmployeeIds),
        assigned_employee_names: stringList(body.assignedEmployeeNames),
        opened_by: actor,
      };
      const { error } = await supabase.from("inventory_work_orders").insert(record);
      if (error) throw error;
      return privateJson({ workOrder: record }, 201);
    }

    if (action === "close_work_order") {
      const workOrderId = clean(body.workOrderId, 80);
      const repairDate = clean(body.repairDate, 40);
      const resolutionNotes = clean(body.resolutionNotes, 1000);
      const repairCost = Number(body.repairCost);
      if (!repairDate || !resolutionNotes || !Number.isFinite(repairCost) || repairCost < 0) {
        return privateJson(
          { error: "Repair date, repair details, and a valid cost are required." },
          400,
        );
      }
      const { data: workOrder } = await supabase
        .from("inventory_work_orders")
        .select("id,linked_exception_id")
        .eq("department_id", departmentId)
        .eq("id", workOrderId)
        .neq("status", "closed")
        .maybeSingle();
      if (!workOrder) return privateJson({ error: "This open repair was not found." }, 404);
      const { error } = await supabase
        .from("inventory_work_orders")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          repair_date: repairDate,
          repair_cost: repairCost,
          vendor: clean(body.vendor, 240) || null,
          invoice_number: clean(body.invoiceNumber, 120) || null,
          resolution_notes: resolutionNotes,
          closed_by: actor,
        })
        .eq("department_id", departmentId)
        .eq("id", workOrderId)
        .neq("status", "closed");
      if (error) throw error;
      if (workOrder.linked_exception_id) {
        const { error: resolveError } = await supabase
          .from("inventory_readiness_exceptions")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: actor,
            resolution_notes: resolutionNotes,
          })
          .eq("department_id", departmentId)
          .eq("id", workOrder.linked_exception_id)
          .neq("status", "resolved");
        if (resolveError) throw resolveError;
      }
      return privateJson({ closed: true });
    }

    if (action === "update_work_order_status") {
      const workOrderId = clean(body.workOrderId, 80);
      const status = clean(body.status, 40);
      const allowed = new Set(["new", "assigned", "in_repair", "waiting_parts"]);
      if (!workOrderId || !allowed.has(status)) {
        return privateJson({ error: "Choose a valid repair status." }, 400);
      }
      const { error } = await supabase
        .from("inventory_work_orders")
        .update({ status })
        .eq("department_id", departmentId)
        .eq("id", workOrderId)
        .neq("status", "closed");
      if (error) throw error;
      return privateJson({ updated: true });
    }

    if (action === "create_stock_item") {
      const name = clean(body.name);
      const unit = clean(body.unit, 40);
      if (!name || !unit) {
        return privateJson({ error: "Supply name and unit are required." }, 400);
      }
      const itemId = crypto.randomUUID();
      const lotId = crypto.randomUUID();
      const quantity = Math.max(0, number(body.quantity));
      const { error: itemError } = await supabase.from("inventory_stock_items").insert({
        id: itemId,
        department_id: departmentId,
        name,
        sku: clean(body.sku, 120) || null,
        barcode: clean(body.barcode, 120) || null,
        unit,
        par_level: Math.max(0, number(body.parLevel)),
        reorder_point: Math.max(0, number(body.reorderPoint)),
        expiration_tracked: Boolean(body.expirationTracked),
      });
      if (itemError) throw itemError;
      const { error: lotError } = await supabase.from("inventory_stock_lots").insert({
        id: lotId,
        department_id: departmentId,
        stock_item_id: itemId,
        location_type: "station",
        location_id: clean(body.locationId, 120) || "main",
        lot_number: clean(body.lotNumber, 120) || null,
        expires_at: clean(body.expiresAt, 40) || null,
        quantity_on_hand: quantity,
      });
      if (lotError) throw lotError;
      await supabase.from("inventory_transactions").insert({
        department_id: departmentId,
        stock_item_id: itemId,
        stock_lot_id: lotId,
        transaction_type: "initial",
        quantity,
        to_location_id: clean(body.locationId, 120) || "main",
        reason: "Initial recorded quantity",
        performed_by: actorId,
      });
      return privateJson({ itemId }, 201);
    }

    if (action === "adjust_stock") {
      const lotId = clean(body.lotId, 80);
      const delta = number(body.delta);
      const { data: lot } = await supabase
        .from("inventory_stock_lots")
        .select("id,stock_item_id,quantity_on_hand,location_id")
        .eq("department_id", departmentId)
        .eq("id", lotId)
        .maybeSingle();
      if (!lot || !delta) {
        return privateJson(
          { error: "Select a supply lot and enter a non-zero adjustment." },
          400,
        );
      }
      const nextQuantity = Math.max(0, Number(lot.quantity_on_hand) + delta);
      const actualDelta = nextQuantity - Number(lot.quantity_on_hand);
      const { error } = await supabase
        .from("inventory_stock_lots")
        .update({ quantity_on_hand: nextQuantity })
        .eq("department_id", departmentId)
        .eq("id", lotId);
      if (error) throw error;
      await supabase.from("inventory_transactions").insert({
        department_id: departmentId,
        stock_item_id: lot.stock_item_id,
        stock_lot_id: lotId,
        transaction_type: actualDelta >= 0 ? "receive" : "use",
        quantity: actualDelta,
        to_location_id: lot.location_id,
        reason: clean(body.reason, 300) || "Manual department adjustment",
        performed_by: actorId,
      });
      return privateJson({ quantityOnHand: nextQuantity });
    }

    if (action === "request_restock") {
      const stockItemId = clean(body.stockItemId, 80);
      const quantity = Math.max(1, number(body.quantity));
      const { data: stockItem } = await supabase
        .from("inventory_stock_items")
        .select("id,name")
        .eq("department_id", departmentId)
        .eq("id", stockItemId)
        .maybeSingle();
      if (!stockItem) return privateJson({ error: "The selected supply was not found." }, 404);
      const { data: existing } = await supabase
        .from("inventory_transactions")
        .select("id")
        .eq("department_id", departmentId)
        .eq("stock_item_id", stockItemId)
        .in("transaction_type", ["restock_requested", "restock_approved"])
        .limit(1)
        .maybeSingle();
      if (existing) return privateJson({ error: "This supply already has an open restock request." }, 409);
      const { data: requestRecord, error } = await supabase
        .from("inventory_transactions")
        .insert({
          department_id: departmentId,
          stock_item_id: stockItemId,
          transaction_type: "restock_requested",
          quantity,
          reason: clean(body.reason, 300) || `Restock requested for ${stockItem.name}`,
          performed_by: actorId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return privateJson({ requestId: requestRecord.id }, 201);
    }

    if (action === "approve_restock" || action === "fulfill_restock") {
      const requestId = clean(body.requestId, 80);
      const expectedStatus = action === "approve_restock" ? "restock_requested" : "restock_approved";
      const nextStatus = action === "approve_restock" ? "restock_approved" : "restock_fulfilled";
      const { data: requestRecord } = await supabase
        .from("inventory_transactions")
        .select("id,reason")
        .eq("department_id", departmentId)
        .eq("id", requestId)
        .eq("transaction_type", expectedStatus)
        .maybeSingle();
      if (!requestRecord) return privateJson({ error: "That restock request is no longer awaiting this action." }, 409);
      const note = `${requestRecord.reason} | ${nextStatus === "restock_approved" ? "Approved" : "Fulfilled"} by ${actor} at ${new Date().toISOString()}`;
      const { error } = await supabase
        .from("inventory_transactions")
        .update({ transaction_type: nextStatus, reason: note })
        .eq("department_id", departmentId)
        .eq("id", requestId)
        .eq("transaction_type", expectedStatus);
      if (error) throw error;
      return privateJson({ updated: true });
    }

    return privateJson({ error: "Unsupported Inventory action." }, 400);
  } catch (error) {
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "That identifier already exists."
      : "The Inventory change could not be saved.";
    return privateJson({ error: message }, 503);
  }
}
