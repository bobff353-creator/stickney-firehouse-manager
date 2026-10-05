import { createInventorySupabaseClient } from "../../lib/supabase-server";
import { privatePacketResponse } from '../../lib/private-packet-response';
import { indexFirstBy, groupByKey } from '../../inventory-index';
import type { LiveCheckPacket } from '../../inventory-history';
import { airAssetInput, airSaveError } from "../../inventory-air-input";
import { serviceScheduleInput } from "../../inventory-service-schedule";
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
    const liveChecks = Promise.resolve(supabase.rpc('inventory_live_check_packet', { p_department: departmentId }))
      .then(result => {
        const packet = result.data as LiveCheckPacket | null;
        const valid = packet && Array.isArray(packet.checks) && Array.isArray(packet.checkItems) && Array.isArray(packet.scbaEntries);
        return { data: valid ? packet : null, error: result.error || (valid ? null : new Error('Current check data is unavailable.')) };
      });
    const [
      apparatusResult,
      fleetResult,
      compartmentsResult,
      equipmentResult,
      checksResult,
      checkItemsResult,
      exceptionsResult,
      workOrdersResult,
      workOrderDocumentsResult,
      inspectionSchedulesResult,
      stockItemsResult,
      stockLotsResult,
      restockRequestsResult,
      equipmentPhotosResult,
      locationChangesResult,
      scbaTemplatesResult,
      scbaEntriesResult,
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
        .select("id,apparatus_id,compartment_id,name,manufacturer,model,serial_number,barcode,quantity_required,equipment_category,check_types,source_form,item_order,retired_at,item_type,parent_equipment_id,purchase_date,in_service_date,expiration_date,response_type,service_status,service_notes,retirement_reason,retired_by,updated_at,scba_asset_kind,asset_number,sku,hydro_test_date,hydro_due_date,scba_notes,scba_check_slot,last_serviced_date,service_interval_months,service_reminder_months")
        .eq("department_id", departmentId)
        .order("item_order")
        .order("name")
        .order("id")
        .range(from, to)),
      liveChecks.then(result => ({ data: result.data?.checks || [], error: result.error })),
      liveChecks.then(result => ({ data: result.data?.checkItems || [], error: result.error })),
      collectPages((from, to) => supabase
        .from("inventory_readiness_exceptions")
        .select("id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,opened_at,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id,resolved_at,resolved_by,resolution_notes")
        .eq("department_id", departmentId)
        .neq("status", "resolved")
        .order("opened_at", { ascending: false }).order("id").range(from, to)),
      collectPages((from, to) => supabase
        .from("inventory_work_orders")
        .select("id,apparatus_id,equipment_id,status,priority,summary,details,assigned_to,opened_by,opened_at,due_at,closed_at,linked_exception_id,assigned_employee_ids,assigned_employee_names,repair_date,repair_cost,vendor,invoice_number,resolution_notes,closed_by,service_type,odometer,labor_hours,performed_by,parts_used,next_service_due_date,next_service_due_mileage")
        .eq("department_id", departmentId)
        .order("opened_at", { ascending: false }).order("id").range(from, to)),
      supabase
        .from("inventory_work_order_documents")
        .select("id,apparatus_id,work_order_id,document_type,original_filename,mime_type,byte_size,note,uploaded_by,uploaded_at")
        .eq("department_id", departmentId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("inventory_inspection_schedules")
        .select("id,apparatus_id,check_type,day_of_week,start_time,end_time,active,feeds_daily_duties,feeds_operations_board,require_officer_signoff,updated_by,updated_at")
        .eq("department_id", departmentId)
        .order("day_of_week")
        .order("start_time"),
      collectPages((from, to) => supabase
        .from("inventory_stock_items")
        .select("id,name,sku,barcode,unit,par_level,reorder_point,expiration_tracked")
        .eq("department_id", departmentId)
        .order("name").order("id").range(from, to)),
      collectPages((from, to) => supabase
        .from("inventory_stock_lots")
        .select("id,stock_item_id,location_type,location_id,lot_number,expires_at,quantity_on_hand")
        .eq("department_id", departmentId).order("id").range(from, to)),
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
      supabase
        .from("inventory_location_change_requests")
        .select("id,equipment_id,check_item_id,from_apparatus_id,from_compartment_id,proposed_apparatus_id,proposed_compartment_id,status,request_notes,requested_by_email,requested_at,reviewed_by_email,reviewed_at,review_notes")
        .eq("department_id", departmentId)
        .order("requested_at", { ascending: false })
        .limit(250),
      supabase
        .from("inventory_scba_templates")
        .select("id,apparatus_id,pack_positions,include_rit,spare_bottle_count,active,updated_by,updated_at")
        .eq("department_id", departmentId)
        .order("updated_at", { ascending: false }),
      liveChecks.then(result => ({ data: result.data?.scbaEntries || [], error: result.error })),
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
      workOrderDocumentsResult,
      inspectionSchedulesResult,
      stockItemsResult,
      stockLotsResult,
      restockRequestsResult,
      equipmentPhotosResult,
      locationChangesResult,
      scbaTemplatesResult,
      scbaEntriesResult,
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
    const compartmentById = new Map(compartments.map((item) => [item.id, item]));
    const photoByEquipment = indexFirstBy(equipmentPhotosResult.data || [], photo => photo.equipment_id);
    const allEquipment = (equipmentResult.data || []).map((item) => ({
      ...item,
      compartment_label: compartmentById.get(item.compartment_id)?.label || "",
      photo_url: photoByEquipment.has(item.id)
        ? `/api/digital-twin/media/${photoByEquipment.get(item.id)?.id}`
        : null,
    }));
    const equipment = allEquipment.filter((item) => !item.retired_at);
    const retiredEquipment = allEquipment.filter((item) => Boolean(item.retired_at));
    const equipmentById = new Map(allEquipment.map((item) => [item.id, item]));
    const apparatusById = new Map(apparatus.map((item) => [item.id, item]));
    const checks = (checksResult.data || []).map((check) => ({
      ...check,
      apparatus_name: apparatusById.get(check.apparatus_id)?.name || "",
      apparatus_status: apparatusById.get(check.apparatus_id)?.status || "not_recorded",
    }));
    const checkItems = (checkItemsResult.data || []).map((item) => {
      const equipmentItem = equipmentById.get(item.equipment_id);
      return {
        ...item,
        equipment_name: equipmentItem?.name || "",
        compartment_label: equipmentItem?.compartment_label || "",
        quantity_required: equipmentItem?.quantity_required || 1,
        source_form: equipmentItem?.source_form || null,
        response_type: equipmentItem?.response_type || "pass_fail",
        expiration_date: equipmentItem?.expiration_date || null,
        service_status: equipmentItem?.service_status || "in_service",
      };
    });
    const exceptions = (exceptionsResult.data || []).map((item) => ({
      ...item,
      apparatus_name: apparatusById.get(item.apparatus_id)?.name || "",
      apparatus_status: apparatusById.get(item.apparatus_id)?.status || "not_recorded",
      equipment_name: equipmentById.get(item.equipment_id)?.name || "",
    }));
    const workOrders = (workOrdersResult.data || []).map((item) => ({
      ...item,
      apparatus_name: apparatusById.get(item.apparatus_id)?.name || "",
      apparatus_status: apparatusById.get(item.apparatus_id)?.status || "not_recorded",
      equipment_name: equipmentById.get(item.equipment_id)?.name || "",
    }));
    const workOrderDocuments = (workOrderDocumentsResult.data || []).map((item) => ({
      ...item,
      url: `/api/operations/documents/${item.id}`,
    }));
    const inspectionSchedules = (inspectionSchedulesResult.data || []).map((item) => ({
      ...item,
      apparatus_name: apparatusById.get(item.apparatus_id)?.name || "Unknown apparatus",
    }));
    const lots = stockLotsResult.data || [];
    const lotsByStock = groupByKey(lots, lot => lot.stock_item_id);
    const stockItemById = indexFirstBy(stockItemsResult.data || [], item => item.id);
    const stock = (stockItemsResult.data || []).flatMap((item) => {
      const itemLots = lotsByStock.get(item.id) || [];
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
      stock_item_name: stockItemById.get(request.stock_item_id)?.name || "Supply",
      unit: stockItemById.get(request.stock_item_id)?.unit || "units",
    }));
    const locationChanges = (locationChangesResult.data || []).map((request) => ({
      ...request,
      equipment_name: equipmentById.get(request.equipment_id)?.name || "Equipment",
      from_apparatus_name: apparatusById.get(request.from_apparatus_id)?.name || "Unknown apparatus",
      from_compartment_label: compartmentById.get(request.from_compartment_id)?.label || "Unknown location",
      proposed_apparatus_name: apparatusById.get(request.proposed_apparatus_id)?.name || "Unknown apparatus",
      proposed_compartment_label: compartmentById.get(request.proposed_compartment_id)?.label || "Unknown location",
    }));
    return privatePacketResponse(request, {
      configured: true,
      apparatus,
      compartments,
      equipment,
      retiredEquipment,
      checks,
      checkItems,
      exceptions,
      workOrders,
      workOrderDocuments,
      inspectionSchedules,
      stock,
      restockRequests,
      locationChanges,
      scbaTemplates: scbaTemplatesResult.data || [],
      scbaEntries: scbaEntriesResult.data || [],
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
    const requiredPermission = ["start_check", "record_check_item", "record_scba_entry", "bulk_record_check_items", "complete_check", "adjust_stock", "request_restock", "request_location_change"].includes(action)
      ? "inventory.check" as const
      : ["create_notice", "create_work_order", "close_work_order", "update_work_order_status", "set_equipment_status", "log_air_maintenance"].includes(action)
        ? "inventory.repairs.manage" as const
        : "inventory.setup.manage" as const;
    if (!canMutateInventory(session.context, requiredPermission)) {
      return privateJson({ error: "Your Inventory permission does not allow this change." }, 403);
    }
    const departmentId = session.context.department.id;
    const actorId = session.context.user.id;
    const actor = session.context.user.email;
    const supabase = await createInventorySupabaseClient();

    if (["adjust_stock", "create_notice", "create_work_order", "close_work_order", "update_work_order_status", "create_stock_item", "request_restock", "approve_restock", "fulfill_restock", "create_stock_lot"].includes(action)) {
      const requestId = clean(body.operationId, 80);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return privateJson({ error: "Refresh this form to obtain a valid save reference." }, 400);
      const { action: ignoredAction, operationId: ignoredId, ...input } = body;
      void ignoredAction; void ignoredId;
      if (action === "create_notice" || action === "create_work_order") {
        input.assignedEmployeeIds = stringList(input.assignedEmployeeIds);
        input.assignedEmployeeNames = stringList(input.assignedEmployeeNames);
        if (action === "create_notice") input.issueCategories = stringList(input.issueCategories, issueCategories, 3);
      }
      const { data, error } = await supabase.rpc("inventory_apply_operation", {
        p_department_id: departmentId, p_request_id: requestId, p_action: action, p_input: input,
      });
      if (error) {
        const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "40001" ? 409 : ["22023", "22P02", "22003", "22007", "22008"].includes(error.code) ? 400 : 503;
        return privateJson({ error: status === 503 ? "Save confirmation was not received. Retry these same details to verify the original save." : error.message }, status);
      }
      if (!data?.requestId) return privateJson({ error: "The operation receipt could not be confirmed. Retry these same details." }, 503);
      return privateJson(data, action.startsWith("create_") ? 201 : 200);
    }

    if (action === "save_air_asset") {
      let asset;
      try { asset = airAssetInput(body.asset); }
      catch (error) { return privateJson({ error: error instanceof Error ? error.message : "Review the asset details." }, 400); }
      const { data, error } = await supabase.rpc("inventory_save_air_asset", {
        p_department: departmentId, p_id: clean(body.id, 80),
        p_expected_updated_at: clean(body.expectedUpdatedAt, 80) || null, p_asset: asset,
      });
      if (error) { const failure = airSaveError(error); return privateJson({ error: failure.error }, failure.status); }
      if (!data?.id) return privateJson({ error: "The asset save could not be confirmed." }, 503);
      return privateJson(data);
    }

    if (action === "log_air_maintenance") {
      const record = {
        summary: clean(body.summary), resolution_notes: clean(body.resolutionNotes, 1000),
        repair_date: clean(body.repairDate, 10), repair_cost: clean(body.repairCost, 20) || null,
        vendor: clean(body.vendor), invoice_number: clean(body.invoiceNumber, 120),
        performed_by: clean(body.performedBy), next_service_due_date: clean(body.nextServiceDueDate, 10) || null,
      };
      if (record.repair_cost !== null && (!Number.isFinite(Number(record.repair_cost)) || Number(record.repair_cost) < 0)) return privateJson({ error: "Enter a nonnegative cost or leave it blank." }, 400);
      const { data, error } = await supabase.rpc("inventory_log_air_maintenance", {
        p_department: departmentId, p_equipment: clean(body.equipmentId, 80), p_id: clean(body.id, 80), p_record: record,
      });
      if (error) { const failure = airSaveError(error); return privateJson({ error: failure.error }, failure.status); }
      if (!data?.id) return privateJson({ error: "The maintenance save could not be confirmed." }, 503);
      return privateJson(data);
    }

    if (action === "save_inspection_schedule") {
      const id = clean(body.id, 80);
      const apparatusId = clean(body.apparatusId, 80);
      const checkType = clean(body.checkType, 40);
      const dayOfWeek = number(body.dayOfWeek, -1);
      const startTime = clean(body.startTime, 8);
      const endTime = clean(body.endTime, 8);
      if (!apparatusId || !checkTypes.has(checkType) || dayOfWeek < 0 || dayOfWeek > 6 || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime) {
        return privateJson({ error: "Choose an apparatus, inspection type, weekday, and a valid start/end time window." }, 400);
      }
      const { data: apparatus } = await supabase.from("inventory_apparatus_profiles").select("id").eq("department_id", departmentId).eq("id", apparatusId).maybeSingle();
      if (!apparatus) return privateJson({ error: "The selected apparatus was not found." }, 404);
      const row = {
        department_id: departmentId,
        apparatus_id: apparatusId,
        check_type: checkType,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        active: body.active !== false,
        feeds_daily_duties: body.feedsDailyDuties !== false,
        feeds_operations_board: body.feedsOperationsBoard !== false,
        require_officer_signoff: body.requireOfficerSignoff !== false,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      };
      const query = id
        ? supabase.from("inventory_inspection_schedules").update(row).eq("department_id", departmentId).eq("id", id).select("id").maybeSingle()
        : supabase.from("inventory_inspection_schedules").upsert({ id: crypto.randomUUID(), ...row, created_by: actor }, { onConflict: "department_id,apparatus_id,check_type,day_of_week" }).select("id").maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.id) return privateJson({ error: "This schedule could not be saved. Refresh and try again." }, 409);
      return privateJson({ scheduleId: data?.id });
    }

    if (action === "delete_inspection_schedule") {
      const id = clean(body.id, 80);
      const { error } = await supabase.from("inventory_inspection_schedules").delete().eq("department_id", departmentId).eq("id", id);
      if (error) throw error;
      return privateJson({ deleted: id });
    }

    if (action === "save_scba_template") {
      const apparatusId = clean(body.apparatusId, 80);
      const packPositions = stringList(body.packPositions, undefined, 12)
        .map((position) => position.slice(0, 80));
      const spareBottleCount = number(body.spareBottleCount, -1);
      const includeRit = body.includeRit !== false;
      if (!apparatusId || spareBottleCount < 0 || spareBottleCount > 20 || (!packPositions.length && !includeRit && spareBottleCount === 0)) {
        return privateJson({ error: "Choose an eligible apparatus and keep at least one SCBA pack, RIT bag, or spare bottle on the checklist." }, 400);
      }
      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id,name,asset_type")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      const excluded = !apparatus
        || clean(apparatus.name, 80).toLowerCase() === "1211"
        || clean(apparatus.name, 80).toLowerCase().includes("utv")
        || clean(apparatus.asset_type, 80).toLowerCase() === "utv";
      if (excluded) return privateJson({ error: "Weekly SCBA templates are not assigned to the UTV or 1211." }, 400);
      const { data: existing } = await supabase
        .from("inventory_scba_templates")
        .select("id")
        .eq("department_id", departmentId)
        .eq("apparatus_id", apparatusId)
        .maybeSingle();
      const changes = {
        pack_positions: packPositions,
        include_rit: includeRit,
        spare_bottle_count: spareBottleCount,
        active: true,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      };
      const query = existing
        ? supabase.from("inventory_scba_templates").update(changes).eq("department_id", departmentId).eq("id", existing.id).select("id").single()
        : supabase.from("inventory_scba_templates").insert({ id: crypto.randomUUID(), department_id: departmentId, apparatus_id: apparatusId, created_by: actor, ...changes }).select("id").single();
      const { data: template, error } = await query;
      if (error) throw error;
      return privateJson({ templateId: template.id });
    }

    if (action === "request_location_change") {
      const checkItemId = clean(body.checkItemId, 80);
      const proposedApparatusId = clean(body.proposedApparatusId, 80);
      const proposedCompartmentId = clean(body.proposedCompartmentId, 80);
      const [{ data: checkItem }, { data: proposedCompartment }] = await Promise.all([
        supabase
          .from("inventory_check_items")
          .select("id,equipment_id,check_id")
          .eq("department_id", departmentId)
          .eq("id", checkItemId)
          .maybeSingle(),
        supabase
          .from("inventory_compartments")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("apparatus_id", proposedApparatusId)
          .eq("id", proposedCompartmentId)
          .maybeSingle(),
      ]);
      if (!checkItem || !proposedCompartment) {
        return privateJson({ error: "Choose an active Inventory item and a saved destination compartment." }, 400);
      }
      const [{ data: check }, { data: equipment }] = await Promise.all([
        supabase
          .from("inventory_checks")
          .select("id")
          .eq("department_id", departmentId)
          .eq("id", checkItem.check_id)
          .eq("check_type", "inventory")
          .eq("status", "in_progress")
          .maybeSingle(),
        supabase
          .from("inventory_equipment")
          .select("id,apparatus_id,compartment_id")
          .eq("department_id", departmentId)
          .eq("id", checkItem.equipment_id)
          .is("retired_at", null)
          .maybeSingle(),
      ]);
      if (!check || !equipment) {
        return privateJson({ error: "That equipment record is no longer available." }, 404);
      }
      if (equipment.apparatus_id === proposedApparatusId && equipment.compartment_id === proposedCompartmentId) {
        return privateJson({ error: "Choose a different apparatus or compartment for this location request." }, 400);
      }
      const requestRecord = {
        id: crypto.randomUUID(),
        department_id: departmentId,
        equipment_id: equipment.id,
        check_item_id: checkItem.id,
        from_apparatus_id: equipment.apparatus_id,
        from_compartment_id: equipment.compartment_id,
        proposed_apparatus_id: proposedApparatusId,
        proposed_compartment_id: proposedCompartmentId,
        status: "pending",
        request_notes: clean(body.requestNotes, 500) || null,
        requested_by: actorId,
        requested_by_email: actor,
      };
      const { data: locationRequest, error: requestError } = await supabase
        .from("inventory_location_change_requests")
        .insert(requestRecord)
        .select("id,equipment_id,check_item_id,from_apparatus_id,from_compartment_id,proposed_apparatus_id,proposed_compartment_id,status,request_notes,requested_by_email,requested_at")
        .single();
      if (requestError?.code === "23505") {
        return privateJson({ error: "This equipment already has a location change waiting for administrator review." }, 409);
      }
      if (requestError) throw requestError;
      return privateJson({ locationRequest }, 201);
    }

    if (action === "review_location_change") {
      const requestId = clean(body.requestId, 80);
      const decision = clean(body.decision, 20);
      if (!requestId || !["approved", "denied"].includes(decision)) {
        return privateJson({ error: "Choose Approve or Deny for a pending location request." }, 400);
      }
      const { data: locationRequest, error: reviewError } = await supabase
        .from("inventory_location_change_requests")
        .update({
          status: decision,
          reviewed_by_email: actor,
          review_notes: clean(body.reviewNotes, 500) || null,
        })
        .eq("department_id", departmentId)
        .eq("id", requestId)
        .eq("status", "pending")
        .select("id,equipment_id,status,reviewed_by_email,reviewed_at,review_notes")
        .single();
      if (reviewError?.code === "PGRST116") {
        return privateJson({ error: "This location request is no longer pending." }, 409);
      }
      if (reviewError) throw reviewError;
      return privateJson({ locationRequest });
    }

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
        item_type: clean(body.itemType, 40) || "individual",
        purchase_date: clean(body.purchaseDate, 40) || null,
        in_service_date: clean(body.inServiceDate, 40) || null,
        expiration_date: clean(body.expirationDate, 40) || null,
        response_type: clean(body.responseType, 40) || "pass_fail",
        service_status: "in_service",
        service_notes: clean(body.serviceNotes, 1000) || null,
      };
      const { error } = await supabase.from("inventory_equipment").insert(record);
      if (error) throw error;
      return privateJson({ equipment: record }, 201);
    }

    if (action === "delete_equipment") {
      const equipmentId = clean(body.equipmentId, 80);
      if (!equipmentId || body.confirmed !== true) {
        return privateJson({ error: "Confirm the inventory item to delete." }, 400);
      }
      const { data: children, error: childrenError } = await supabase
        .from("inventory_equipment").select("id")
        .eq("department_id", departmentId).eq("parent_equipment_id", equipmentId)
        .is("retired_at", null).limit(1);
      if (childrenError) throw childrenError;
      if (children?.length) {
        return privateJson({ error: "Move or delete the items inside this kit or container before deleting it." }, 409);
      }
      const now = new Date().toISOString();
      const { data: deleted, error: deleteError } = await supabase
        .from("inventory_equipment")
        .update({ retired_at: now, retired_by: actor, retirement_reason: "Deleted from active inventory", service_status: "retired", updated_at: now })
        .eq("department_id", departmentId).eq("id", equipmentId)
        .is("retired_at", null).select("id").maybeSingle();
      if (deleteError) throw deleteError;
      if (!deleted) return privateJson({ error: "This active inventory item was not found." }, 404);
      return privateJson({ deleted: deleted.id });
    }

    if (action === "update_equipment") {
      const equipmentId = clean(body.equipmentId, 80);
      const compartmentId = clean(body.compartmentId, 80);
      const name = clean(body.name);
      const [{ data: equipment }, { data: compartment }] = await Promise.all([
        supabase
          .from("inventory_equipment")
          .select("*")
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
      if (!equipment || !compartment || !name) {
        return privateJson({ error: "Choose a saved item, apparatus compartment, and name." }, 400);
      }
      if (equipment.scba_asset_kind) return privateJson({ error: "Edit this registered ID in Air Packs & Bottles so its location and weekly position stay linked." }, 409);
      const parentEquipmentId = clean(body.parentEquipmentId, 80) || null;
      if (parentEquipmentId === equipmentId) {
        return privateJson({ error: "An item cannot be grouped inside itself." }, 400);
      }
      if (parentEquipmentId) {
        const { data: parentEquipment } = await supabase
          .from("inventory_equipment")
          .select("id,apparatus_id")
          .eq("department_id", departmentId)
          .eq("id", parentEquipmentId)
          .is("retired_at", null)
          .maybeSingle();
        if (!parentEquipment || parentEquipment.apparatus_id !== compartment.apparatus_id) {
          return privateJson({ error: "Choose a kit or container assigned to the selected apparatus." }, 400);
        }
      }
      let serviceSchedule = {};
      try { if (body.serviceSchedule) serviceSchedule = serviceScheduleInput(body.serviceSchedule as Record<string, unknown>); }
      catch (caught) { return privateJson({ error: caught instanceof Error ? caught.message : "Review the service schedule." }, 400); }
      if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== equipment.updated_at) return privateJson({ error: "This item changed on another screen. Reopen it before saving." }, 409);
      const serviceStatus = clean(body.serviceStatus, 40) || "in_service";
      const retiring = serviceStatus === "retired";
      const changes = {
        ...serviceSchedule,
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
        item_type: clean(body.itemType, 40) || "individual",
        parent_equipment_id: parentEquipmentId,
        purchase_date: clean(body.purchaseDate, 40) || null,
        in_service_date: clean(body.inServiceDate, 40) || null,
        expiration_date: clean(body.expirationDate, 40) || null,
        response_type: clean(body.responseType, 40) || "pass_fail",
        service_status: serviceStatus,
        service_notes: clean(body.serviceNotes, 1000) || null,
        retired_at: retiring ? new Date().toISOString() : null,
        retired_by: retiring ? actor : null,
        retirement_reason: retiring ? clean(body.retirementReason, 1000) || "Retired by administrator" : null,
        updated_at: new Date().toISOString(),
      };
      const unchanged = Object.entries(changes).every(([key, value]) => key === "updated_at" || JSON.stringify(equipment[key]) === JSON.stringify(value));
      if (unchanged) return privateJson({ equipment, changed: false });
      const update = supabase.from("inventory_equipment").update(changes).eq("department_id", departmentId).eq("id", equipmentId).is("retired_at", null);
      const { data: saved, error } = await (equipment.updated_at ? update.eq("updated_at", equipment.updated_at) : update.is("updated_at", null)).select("id").maybeSingle();
      if (error) throw error;
      if (!saved) return privateJson({ error: "This item changed or your access changed. Reopen it before saving." }, 409);
      return privateJson({ equipment: { id: equipmentId, ...changes }, changed: true });
    }

    if (action === "review_check") {
      const checkId = clean(body.checkId, 80);
      const decision = clean(body.decision, 40);
      const reviewNotes = clean(body.reviewNotes, 1000);
      if (!checkId || !["approved", "changes_requested"].includes(decision)) {
        return privateJson({ error: "Choose Approve or Request changes for a completed check." }, 400);
      }
      if (decision === "changes_requested" && !reviewNotes) {
        return privateJson({ error: "Enter the correction needed before returning this check." }, 400);
      }
      const { data: reviewedCheck, error: reviewError } = await supabase
        .from("inventory_checks")
        .update({
          review_status: decision,
          reviewed_by: actor,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq("department_id", departmentId)
        .eq("id", checkId)
        .eq("status", "completed")
        .eq("review_status", "pending")
        .select("id,review_status,reviewed_by,reviewed_at,review_notes")
        .maybeSingle();
      if (reviewError) throw reviewError;
      if (!reviewedCheck) return privateJson({ error: "This completed check is no longer awaiting review." }, 409);
      return privateJson({ check: reviewedCheck });
    }

    if (action === "set_equipment_status") {
      const equipmentId = clean(body.equipmentId, 80);
      const serviceStatus = clean(body.serviceStatus, 40);
      if (!equipmentId || !["in_service", "out_of_service", "in_repair"].includes(serviceStatus)) {
        return privateJson({ error: "Choose In service, Out of service, or In repair." }, 400);
      }
      const { data: updatedEquipment, error: statusError } = await supabase
        .from("inventory_equipment")
        .update({
          service_status: serviceStatus,
          service_notes: clean(body.serviceNotes, 1000) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("department_id", departmentId)
        .eq("id", equipmentId)
        .is("retired_at", null)
        .select("id,service_status,service_notes,updated_at")
        .maybeSingle();
      if (statusError) throw statusError;
      if (!updatedEquipment) return privateJson({ error: "This active equipment record was not found." }, 404);
      return privateJson({ equipment: updatedEquipment });
    }

    if (action === "start_check") {
      const apparatusId = clean(body.apparatusId, 80);
      const checkType = clean(body.checkType, 40);
      if (!checkTypes.has(checkType)) {
        return privateJson({ error: "Choose Daily, Weekly, Inventory, or Air Pack check." }, 400);
      }
      if (checkType === "air_pack") {
        const { data, error } = await supabase.rpc("inventory_start_air_check", {
          p_department: departmentId, p_apparatus: apparatusId, p_shift: clean(body.shiftId, 80) || null,
        });
        if (error) { const failure = airSaveError(error); return privateJson({ error: failure.error }, failure.status); }
        if (!data?.checkId) return privateJson({ error: "The air check could not be opened." }, 503);
        return privateJson(data, data.resumed ? 200 : 201);
      }
      const [{ data: apparatus }, { data: fleetApparatus }, { data: equipment }] = await Promise.all([
        supabase
          .from("inventory_apparatus_profiles")
          .select("id")
          .eq("department_id", departmentId)
          .eq("id", apparatusId)
          .maybeSingle(),
        supabase
          .from("department_apparatus")
          .select("id,status")
          .eq("department_id", departmentId)
          .eq("id", apparatusId)
          .maybeSingle(),
        supabase
          .from("inventory_equipment")
          .select("id,check_types")
          .eq("department_id", departmentId)
          .eq("apparatus_id", apparatusId)
          .is("retired_at", null),
      ]);
      if (!apparatus) {
        return privateJson({ error: "Select a saved department apparatus." }, 400);
      }
      if (fleetApparatus?.status === "out_of_service" && ["daily", "weekly"].includes(checkType)) {
        return privateJson({ error: "Not needed — this apparatus is Out of Service. Daily and weekly checks resume when Fleet returns it to service." }, 409);
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

    if (action === "record_scba_entry") {
      const entryId = clean(body.entryId, 80);
      const result = clean(body.result, 40);
      const harnessNumber = clean(body.harnessNumber, 80) || null;
      const cylinderNumber = clean(body.cylinderNumber, 80) || null;
      const psi = number(body.psi, -1);
      const notes = clean(body.notes, 500) || null;
      if (!entryId || !["pass", "failed", "not_applicable"].includes(result)) {
        return privateJson({ error: "Choose Pass, Issue, or N/A for this SCBA entry." }, 400);
      }
      const { data: entry } = await supabase
        .from("inventory_scba_check_entries")
        .select("id,check_id,section,equipment_id,asset_number")
        .eq("department_id", departmentId)
        .eq("id", entryId)
        .maybeSingle();
      if (!entry) return privateJson({ error: "This SCBA checklist entry was not found." }, 404);
      const { data: check } = await supabase
        .from("inventory_checks")
        .select("id,status,check_type")
        .eq("department_id", departmentId)
        .eq("id", entry.check_id)
        .eq("status", "in_progress")
        .eq("check_type", "air_pack")
        .maybeSingle();
      if (!check) return privateJson({ error: "This weekly SCBA check is no longer active." }, 409);
      if (result !== "not_applicable") {
        if (entry.asset_number && (entry.section === "pack" ? harnessNumber : cylinderNumber) !== entry.asset_number) return privateJson({ error: "This checklist line is linked to a specific equipment ID. Check that item; ask an administrator to update the assignment if it has moved." }, 409);
        if (entry.section === "pack" && !harnessNumber) return privateJson({ error: "Enter the SCBA harness number." }, 400);
        if (!cylinderNumber) return privateJson({ error: "Enter the cylinder number." }, 400);
        if (psi < 0 || psi > 6000) return privateJson({ error: "Enter a PSI reading from 0 to 6000." }, 400);
      }
      if (result === "failed" && !notes) return privateJson({ error: "Describe the SCBA deficiency before saving an issue." }, 400);
      const { data: savedEntry, error } = await supabase
        .from("inventory_scba_check_entries")
        .update({
          harness_number: result === "not_applicable" ? null : harnessNumber,
          cylinder_number: result === "not_applicable" ? null : cylinderNumber,
          psi: result === "not_applicable" ? null : psi,
          result,
          notes,
          checked_by: actor,
          checked_at: new Date().toISOString(),
        })
        .eq("department_id", departmentId)
        .eq("id", entryId)
        .select("id,check_id,section,label,sort_order,harness_number,cylinder_number,psi,result,notes,checked_by,checked_at")
        .single();
      if (error) throw error;
      return privateJson({ scbaEntry: savedEntry });
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
          .select("id,name,equipment_category,response_type")
          .eq("department_id", departmentId)
          .eq("id", item.equipment_id)
          .maybeSingle(),
      ]);
      if (!check || !equipment) {
        return privateJson({ error: "This active check item was not found." }, 404);
      }
      const notes = clean(body.notes, 500) || null;
      const equipmentName = clean(equipment.name, 300);
      const isNumericReadingItem = ["numeric", "mileage", "quantity"].includes(equipment.response_type || "")
        || /\b(mileage|odometer)\b/i.test(equipmentName) || /\b(miles|milage|millage)\b/i.test(equipmentName);
      const numericReadingInput = body.numericReading;
      const numericReading = (typeof numericReadingInput !== "number" && typeof numericReadingInput !== "string") || (typeof numericReadingInput === "string" && numericReadingInput.trim() === "")
        ? null
        : Number(numericReadingInput);
      if (isNumericReadingItem && (numericReading === null || !Number.isFinite(numericReading) || numericReading < 0)) {
        return privateJson(
          { error: "Enter the required numeric reading before saving this item." },
          400,
        );
      }
      if (isNumericReadingItem && result !== "pass") {
        return privateJson({ error: "This item must be saved as a numeric reading." }, 400);
      }
      if (/\b(engine oil|transmission fluid)\b/i.test(equipmentName)) {
        const level = notes?.split("\n")[0];
        if (!((result === "pass" && level === "Fluid level: In range")
          || (result === "failed" && ["Fluid level: Low", "Fluid level: High"].includes(level || "")))) {
          return privateJson({ error: "Choose Low, In range, or High for this fluid level." }, 400);
        }
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
      const { data: saved, error } = await supabase.rpc("inventory_record_item_atomic", {
        p_department_id: departmentId,
        p_check_item_id: checkItemId,
        p_result: result,
        p_notes: notes,
        p_numeric_reading: isNumericReadingItem ? numericReading : null,
        p_evidence_photo_id: evidencePhotoId,
        p_categories: categories,
        p_assigned_ids: assignedEmployeeIds,
        p_assigned_names: assignedEmployeeNames,
      });
      if (error) throw error;
      return privateJson(saved);
    }

    if (action === "bulk_record_check_items") {
      const checkId = clean(body.checkId, 80);
      const requestedIds = stringList(body.checkItemIds, undefined, 250);
      if (!checkId || !requestedIds.length) {
        return privateJson({ error: "Choose at least one pending inventory item." }, 400);
      }
      const { data: check } = await supabase
        .from("inventory_checks")
        .select("id,check_type,status")
        .eq("department_id", departmentId)
        .eq("id", checkId)
        .eq("status", "in_progress")
        .maybeSingle();
      if (!check || check.check_type !== "inventory") {
        return privateJson({ error: "Bulk pass is available only for an active Inventory check." }, 400);
      }
      const { data: requestedItems, error: requestedError } = await supabase
        .from("inventory_check_items")
        .select("id,equipment_id,result")
        .eq("department_id", departmentId)
        .eq("check_id", checkId)
        .in("id", requestedIds);
      if (requestedError) throw requestedError;
      if (!requestedItems?.length) {
        return privateJson({ error: "Those pending inventory items are no longer available." }, 409);
      }
      const equipmentIds = [...new Set((requestedItems || []).map((item) => item.equipment_id))];
      const { data: bulkEquipment, error: equipmentError } = await supabase
        .from("inventory_equipment")
        .select("id,name,response_type")
        .eq("department_id", departmentId)
        .in("id", equipmentIds);
      if (equipmentError) throw equipmentError;
      const equipmentByIdForBulk = new Map((bulkEquipment || []).map((item) => [item.id, item]));
      const safeIds = (requestedItems || [])
        .filter((item) => {
          const equipment = equipmentByIdForBulk.get(item.equipment_id);
          return item.result === "pending"
            && !["numeric", "mileage", "quantity"].includes(equipment?.response_type || "")
            && !/\b(mileage|odometer)\b/i.test(equipment?.name || "")
            && !/\b(miles|milage|millage|engine oil|transmission fluid)\b/i.test(equipment?.name || "");
        })
        .map((item) => item.id);
      if (!safeIds.length) {
        return privateJson({ error: "No pending standard items were available to pass." }, 409);
      }
      const checkedAt = new Date().toISOString();
      const { data: updatedItems, error: updateError } = await supabase
        .from("inventory_check_items")
        .update({ result: "pass", checked_by: actor, checked_at: checkedAt })
        .eq("department_id", departmentId)
        .eq("check_id", checkId)
        .eq("result", "pending")
        .in("id", safeIds)
        .select("id,check_id,equipment_id,result,notes,numeric_reading,checked_by,checked_at");
      if (updateError) throw updateError;
      return privateJson({ saved: true, checkItems: updatedItems || [] });
    }

    if (action === "complete_check") {
      const checkId = clean(body.checkId, 80);
      const { data: completed, error } = await supabase.rpc("inventory_complete_check_atomic", { p_department_id: departmentId, p_check_id: checkId });
      if (error) throw error;
      return privateJson(completed);
    }

    return privateJson({ error: "Unsupported Inventory action." }, 400);
  } catch (error) {
    const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (/inspection is no longer in progress|Complete a configured checklist|Multiple open repair notices/.test(detail)) return privateJson({ error: detail }, 409);
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "That identifier already exists."
      : "The Inventory change could not be saved.";
    return privateJson({ error: message }, 503);
  }
}
