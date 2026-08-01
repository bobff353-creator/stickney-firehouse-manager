import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("keeps Inventory on the Stickney site", async () => {
  const [proxy, navigation, inventoryPage] = await Promise.all([
    read("app/[[...path]]/route.ts"),
    read("public/inventory-route.js"),
    read("app/inventory/page.tsx"),
  ]);

  assert.match(proxy, /inventory-route\.js/);
  assert.match(proxy, /headers\.set\(\s*"location"/);
  assert.match(proxy, /headers\.delete\("content-encoding"\)/);
  assert.match(proxy, /headers\.delete\("content-length"\)/);
  assert.match(navigation, /new Set\(\["Inventory", "Open Inventory"\]\)/);
  assert.match(navigation, /window\.addEventListener/);
  assert.match(navigation, /window\.location\.assign\("\/inventory"\)/);
  assert.match(inventoryPage, /verifyInventoryServerSession/);
  assert.match(inventoryPage, /<Inventory360/);
});

test("ships a real-photo Fleet digital twin with mobile camera capture", async () => {
  const [component, operations, api, mediaApi] = await Promise.all([
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("app/api/digital-twin/route.ts"),
    read("app/api/digital-twin/media/[id]/route.ts"),
  ]);

  assert.match(component, /DIGITAL TWIN BUILDER/);
  assert.match(component, /Photo Required/i);
  assert.match(component, /Open rear camera/);
  assert.match(component, /Capture photo/);
  assert.match(component, /accept="image\/\*"/);
  assert.match(component, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(component, /facingMode: \{ ideal: "environment" \}/);
  assert.match(component, /Choose existing apparatus photo/);
  assert.match(component, /Take photo for hotspots/);
  assert.match(component, /Tap to open camera/);
  assert.match(component, /cameraVideoRef/);
  assert.match(component, /Save apparatus to Inventory/);
  assert.match(component, /Save compartment/);
  assert.match(component, /updateCompartment/);
  assert.match(component, /deleteCompartment/);
  assert.match(component, /Replace photo/);
  assert.match(component, /Remove photo/);
  assert.match(component, /photoCompartmentId/);
  assert.match(component, /"state":"closed","label":"Closed"/);
  assert.match(component, /"state":"open","label":"Open"/);
  assert.match(component, /2 required photos/);
  assert.match(component, /PHOTO SET COMPLETE/);
  assert.match(component, /Save photo for review/);
  assert.match(component, /Save hotspot/);
  assert.match(component, /setPendingHotspot/);
  assert.match(component, /effectiveHotspotCompartmentId/);
  assert.match(component, /setHotspotCompartmentId\(createdCompartmentId\)/);
  assert.match(component, /saved compartment/);
  assert.match(component, /Operational status always comes from Fleet/);
  assert.match(component, /Back to Firehouse Manager/);
  assert.match(component, /Station Duties/);
  assert.match(component, /InventoryNavIcon/);
  assert.match(component, /openFleetFilter/);
  assert.match(component, /Fleet: \{titleCase\(selectedApparatus\.status\)\}/);
  assert.match(operations, /Fleet: \{formatStatus\(item\.status\)\}/);
  assert.match(api, /\.from\("department_apparatus"\)/);
  assert.match(component, /placeHotspot/);
  assert.match(component, /Save photo for review/);
  assert.match(component, /Save the apparatus in Step 1 before adding a compartment/);
  assert.match(component, /Save apparatus first/);
  assert.match(operations, /Start a shift check/);
  assert.match(operations, /Scan barcode/);
  assert.match(operations, /BrowserMultiFormatReader/);
  assert.match(operations, /facingMode: \{ ideal: "environment" \}/);
  assert.match(operations, /parseScannedEquipment/);
  assert.match(operations, /Open work order/);
  assert.match(operations, /Return to department portal/);
  assert.match(operations, /Number\(lot\.quantity_on_hand \|\| 0\) <= 0/);
  assert.match(api, /inventory_photo_views/);
  assert.match(api, /inventory_photo_hotspots/);
  assert.match(api, /action === "update_compartment"/);
  assert.match(api, /action === "delete_compartment"/);
  assert.match(api, /action === "delete_photo"/);
  assert.match(api, /compartment\.updated/);
  assert.match(api, /photo\.deleted/);
  assert.match(api, /inventory_audit_events/);
  assert.match(api, /status: "in_service"/);
  assert.doesNotMatch(api, /status: "active"/);
  assert.match(mediaApi, /stickney-inventory-media/);
  assert.match(mediaApi, /supabase\.storage/);
  assert.doesNotMatch(
    `${component}\n${operations}`,
    /Engine 7|Truck 7|Medic 7|Station 7|WO-1042|sterile gauze|epinephrine/i,
  );
  await access(new URL("public/og.png", root));
});

test("defines durable department-scoped inventory without demo inserts", async () => {
  const migration = await read(
    "supabase/migrations/20260730210000_stickney_inventory_digital_twin.sql",
  );

  for (const table of [
    "inventory_apparatus_profiles",
    "inventory_compartments",
    "inventory_photo_views",
    "inventory_photo_hotspots",
    "inventory_checks",
    "inventory_work_orders",
    "inventory_stock_items",
    "inventory_audit_events",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }

  assert.match(migration, /enable row level security/);
  assert.match(migration, /inventory_can_access/);
  assert.match(migration, /inventory_can_write/);
  assert.match(migration, /insert into public\.departments/);
  assert.match(migration, /stickney-fire-department/);
  assert.match(migration, /insert into storage\.buckets/);
  assert.match(migration, /false,\s*20971520/);
  assert.doesNotMatch(migration, /insert into public\.department_apparatus/);
  assert.doesNotMatch(migration, /insert into public\.inventory_equipment/);
});

test("connects fleet inspections, employee notices, Live Ops, and repair closeout", async () => {
  const [component, operationsApi, dashboardApi, noticeApi, evidenceApi, proxy, migration] = await Promise.all([
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
    read("app/api/dashboard/route.ts"),
    read("app/api/fleet-notices/route.ts"),
    read("app/api/operations/evidence/route.ts"),
    read("app/[[...path]]/route.ts"),
    read("supabase/migrations/20260801200000_fleet_inspections_repairs.sql"),
  ]);

  for (const label of ["Daily inspection", "Weekly inspection", "Inventory check", "Air pack check"]) {
    assert.match(component, new RegExp(label));
  }
  assert.match(component, /A failed item requires a note and attached photo|Required photo/);
  assert.match(component, /Vehicle/);
  assert.match(component, /Air pack/);
  assert.match(component, /Equipment/);
  assert.match(component, /MY ASSIGNED REPAIRS/);
  assert.match(component, /repairDate/);
  assert.match(component, /repairCost/);
  assert.match(component, /resolutionNotes/);
  assert.match(operationsApi, /action === "create_notice"/);
  assert.match(operationsApi, /linked_exception_id/);
  assert.match(operationsApi, /status: "resolved"/);
  assert.match(dashboardApi, /equipmentIssues/);
  assert.match(noticeApi, /assigned_employee_ids/);
  assert.match(evidenceApi, /inventory_deficiency_photos/);
  assert.match(proxy, /fleet-notices\.js/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /inventory_deficiency_photos/);
  assert.match(migration, /assigned_employee_ids/);
  assert.match(migration, /repair_cost/);
});

test("loads the 1203 FRONTLINE checklist as editable weekly, inventory, and air-pack records", async () => {
  const [operations, operationsApi, digitalTwinApi, migration] = await Promise.all([
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
    read("app/api/digital-twin/route.ts"),
    read("supabase/migrations/20260801213000_seed_1203_frontline_checklist.sql"),
  ]);

  assert.match(migration, /1203 Weekly Check \(FRONTLINE\) form 251/);
  assert.equal((migration.match(/'frontline-251-\d{3}'/g) || []).length, 289);
  for (const section of ["Vehicle", "Cab - Cabinet", "SCBA", "Compartment 1 (Top)", "Rear Compartment", "Hose"]) {
    assert.match(migration, new RegExp(section.replace(/[()]/g, "\\$&")));
  }
  assert.match(migration, /array\['weekly','inventory','air_pack'\]/);
  assert.match(migration, /Officer SCBA harness and cylinder at 4500 PSI/);
  assert.match(migration, /L\.D\.H\. supply \(rear\)/);
  assert.match(operationsApi, /action === "update_equipment"/);
  assert.match(operations, /Edit items, barcodes and photographs/);
  assert.match(operations, /capture="environment"/);
  assert.match(operations, /interior-equipment-/);
  assert.match(digitalTwinApi, /Select equipment from this apparatus and compartment/);
});

test("loads the distinct 1204 truck form as weekly, inventory, and air-pack records", async () => {
  const migration = await read("supabase/migrations/20260801214500_seed_1204_weekly_checklist.sql");

  assert.match(migration, /1204 Weekly Check form 439/);
  assert.equal((migration.match(/^      \('/gm) || []).length, 166);
  for (const section of ["Outrigger stabilizers and aerial operational", "Compartment 1 (EMS)", "SCBA", "Compartment 7 (Rear)", "Rear Hose", "Compartment 13"]) {
    assert.match(migration, new RegExp(section.replace(/[()]/g, "\\$&")));
  }
  assert.match(migration, /array\['weekly','inventory','air_pack'\]/);
  assert.match(migration, /R\.I\.T\. bag - 60 minute cylinder/);
  assert.match(migration, /Hardwire battery adapter for Genesis E-Tools/);
  assert.match(migration, /source_key is not null/);
});
