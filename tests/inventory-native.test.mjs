import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Inventory is native, durable, Fleet-linked, and contains no demo seed",async()=>{
 const [ui,api,db]=await Promise.all([read("../app/inventory-page.tsx"),read("../app/api/inventory/route.ts"),read("../db/bootstrap.ts")]);
 assert.match(ui,/Fleet-linked apparatus/);assert.match(api,/fleet_apparatus/);assert.match(db,/CREATE TABLE IF NOT EXISTS fleet_apparatus/);
 assert.doesNotMatch(`${ui}\n${api}\n${db}`,/demo apparatus|sample apparatus|DEMO-\d|inventory-360-command/i);
 assert.match(ui,/No apparatus entered/);assert.match(ui,/No compartments created/);assert.match(ui,/No real equipment records entered/);
});

test("Inventory camera, paired photos, hotspots, saves, and mobile navigation are wired",async()=>{
 const [ui,css,portal]=await Promise.all([read("../app/inventory-page.tsx"),read("../app/globals.css"),read("../app/payroll-app.tsx")]);
 assert.match(ui,/accept="image\/\*" capture="environment"/);assert.match(ui,/compartment_\$\{state\}/);assert.match(ui,/photo required/);assert.match(ui,/\["closed","open"\]/);
 for(const stage of ["Fleet stage","apparatus photo stage","compartment stage","hotspot stage","equipment stage","readiness stage","service stage"])assert.match(ui,new RegExp(`Save ${stage}`,"i"));
 assert.match(ui,/BarcodeDetector/);assert.match(ui,/getUserMedia/);assert.match(ui,/Existing compartment/);assert.match(css,/safe-area-inset-bottom/);assert.match(portal,/mobile-bottom-tabs/);
});

test("Inventory changes require server permissions and preserve linked history",async()=>{
 const api=await read("../app/api/inventory/route.ts");
 assert.match(api,/hasPermission\(request, db, "settings\.manage"\)/);assert.match(api,/Linked inventory history prevents deletion/);assert.match(api,/Equipment retired with history preserved/);assert.match(api,/inventory_audit_events/);
});

test("approved 1203 form imports stable real compartments and a separate weekly check",async()=>{
 const [source,db,api,ui]=await Promise.all([read("../app/inventory-1203-import.ts"),read("../db/bootstrap.ts"),read("../app/api/inventory/route.ts"),read("../app/inventory-page.tsx")]);
 for(const compartment of ["Cab","Compartment 1 (Top)","Compartment 1 (Bottom)","Compartment 7","Officer's Side Step","Hose"])assert.match(source,new RegExp(compartment.replace(/[()]/g,"\\$&")));
 for(const item of ["Thermal imaging camera","RIT bag","Genesis E-tool spreader","24-foot extension ladder","LDH supply - rear"])assert.match(source,new RegExp(item));
 assert.match(db,/unit_number='1203'/);assert.match(db,/INSERT OR IGNORE INTO inventory_equipment/);assert.match(db,/inventory_weekly_check_templates/);assert.match(api,/save_weekly_check/);assert.match(ui,/weekly apparatus check/);assert.match(ui,/Complete every item to submit/);
 assert.doesNotMatch(source,/demo|sample|fabricated/i);
});
