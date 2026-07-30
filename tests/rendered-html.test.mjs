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
  assert.match(component, /Take apparatus photo/);
  assert.match(component, /accept="image\/\*"/);
  assert.match(component, /capture="environment"/);
  assert.match(component, /Phone\/iPad: use the rear camera/);
  assert.match(component, /placeHotspot/);
  assert.match(component, /Upload for review/);
  assert.match(operations, /Start a shift check/);
  assert.match(operations, /Open work order/);
  assert.match(api, /inventory_photo_views/);
  assert.match(api, /inventory_photo_hotspots/);
  assert.match(api, /inventory_audit_events/);
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
