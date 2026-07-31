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

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
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
    ] = await Promise.all([
      supabase
        .from("inventory_apparatus_profiles")
        .select("id,name,asset_type")
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
      supabase
        .from("inventory_equipment")
        .select("id,apparatus_id,compartment_id,name,manufacturer,model,serial_number,barcode,quantity_required")
        .eq("department_id", departmentId)
        .order("name"),
      supabase
        .from("inventory_checks")
        .select("id,apparatus_id,shift_id,status,started_by,started_at,completed_at")
        .eq("department_id", departmentId)
        .order("started_at", { ascending: false })
        .limit(30),
      supabase
        .from("inventory_check_items")
        .select("id,check_id,equipment_id,result,notes,checked_by,checked_at")
        .eq("department_id", departmentId),
      supabase
        .from("inventory_readiness_exceptions")
        .select("id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,opened_at")
        .eq("department_id", departmentId)
        .neq("status", "resolved")
        .order("opened_at", { ascending: false }),
      supabase
        .from("inventory_work_orders")
        .select("id,apparatus_id,equipment_id,status,priority,summary,details,assigned_to,opened_by,opened_at,due_at,closed_at")
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
    const equipment = (equipmentResult.data || []).map((item) => ({
      ...item,
      compartment_label: compartments.find((row) => row.id === item.compartment_id)?.label || "",
    }));
    const checks = (checksResult.data || []).map((check) => ({
      ...check,
      apparatus_name: apparatus.find((row) => row.id === check.apparatus_id)?.name || "",
      apparatus_status: apparatus.find((row) => row.id === check.apparatus_id)?.status || "not_recorded",
    }));
    const checkItems = (checkItemsResult.data || []).map((item) => {
      const equipmentItem = equipment.find((row) => row.id === item.equipment_id);
      return {
        ...item,
        equipment_name: equipmentItem?.name || "",
        compartment_label: equipmentItem?.compartment_label || "",
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
  if (
    !sameOriginInventoryRequest(request)
    || !canMutateInventory(session.context.role)
  ) {
    return privateJson(
      { error: "Your department role cannot change Inventory records." },
      403,
    );
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 60);
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
      };
      const { error } = await supabase.from("inventory_equipment").insert(record);
      if (error) throw error;
      return privateJson({ equipment: record }, 201);
    }

    if (action === "start_check") {
      const apparatusId = clean(body.apparatusId, 80);
      const { data: apparatus } = await supabase
        .from("inventory_apparatus_profiles")
        .select("id")
        .eq("department_id", departmentId)
        .eq("id", apparatusId)
        .maybeSingle();
      const { data: equipment } = await supabase
        .from("inventory_equipment")
        .select("id")
        .eq("department_id", departmentId)
        .eq("apparatus_id", apparatusId);
      if (!apparatus) {
        return privateJson({ error: "Select a saved department apparatus." }, 400);
      }
      if (!equipment?.length) {
        return privateJson(
          { error: "Add at least one equipment item before starting a check." },
          400,
        );
      }
      const checkId = crypto.randomUUID();
      const { error: checkError } = await supabase.from("inventory_checks").insert({
        id: checkId,
        department_id: departmentId,
        apparatus_id: apparatusId,
        shift_id: clean(body.shiftId, 80) || null,
        status: "in_progress",
        started_by: actor,
      });
      if (checkError) throw checkError;
      const { error: itemError } = await supabase.from("inventory_check_items").insert(
        equipment.map((item) => ({
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
      if (!["pass", "missing", "damaged", "not_applicable"].includes(result)) {
        return privateJson(
          { error: "Choose Pass, Missing, Damaged, or Not applicable." },
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
          .select("id,apparatus_id,status")
          .eq("department_id", departmentId)
          .eq("id", item.check_id)
          .eq("status", "in_progress")
          .maybeSingle(),
        supabase
          .from("inventory_equipment")
          .select("id")
          .eq("department_id", departmentId)
          .eq("id", item.equipment_id)
          .maybeSingle(),
      ]);
      if (!check || !equipment) {
        return privateJson({ error: "This active check item was not found." }, 404);
      }
      const notes = clean(body.notes, 500) || null;
      const { error } = await supabase
        .from("inventory_check_items")
        .update({
          result,
          notes,
          checked_by: actor,
          checked_at: new Date().toISOString(),
        })
        .eq("department_id", departmentId)
        .eq("id", checkItemId);
      if (error) throw error;
      if (["missing", "damaged"].includes(result)) {
        const { data: existing } = await supabase
          .from("inventory_readiness_exceptions")
          .select("id")
          .eq("department_id", departmentId)
          .eq("check_item_id", checkItemId)
          .neq("status", "resolved")
          .maybeSingle();
        if (!existing) {
          const { error: exceptionError } = await supabase
            .from("inventory_readiness_exceptions")
            .insert({
              department_id: departmentId,
              apparatus_id: check.apparatus_id,
              equipment_id: item.equipment_id,
              check_item_id: checkItemId,
              result,
              priority: result === "missing" ? "high" : "medium",
              notes: notes || `${result} during apparatus check`,
              status: "open",
              out_of_service: false,
              opened_by: actor,
            });
          if (exceptionError) throw exceptionError;
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
        status: "open",
        priority: clean(body.priority, 40) || "routine",
        summary,
        details: clean(body.details, 1000) || null,
        assigned_to: clean(body.assignedTo, 160) || null,
        opened_by: actor,
      };
      const { error } = await supabase.from("inventory_work_orders").insert(record);
      if (error) throw error;
      return privateJson({ workOrder: record }, 201);
    }

    if (action === "close_work_order") {
      const workOrderId = clean(body.workOrderId, 80);
      const { error } = await supabase
        .from("inventory_work_orders")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("department_id", departmentId)
        .eq("id", workOrderId)
        .neq("status", "closed");
      if (error) throw error;
      return privateJson({ closed: true });
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

    return privateJson({ error: "Unsupported Inventory action." }, 400);
  } catch (error) {
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "That identifier already exists."
      : "The Inventory change could not be saved.";
    return privateJson({ error: message }, 503);
  }
}
