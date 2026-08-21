import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("operational preplan assets remain private and permission checked",async()=>{
  const [upload,download]=await Promise.all([
    readFile(new URL("../app/api/field-preplans/assets/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/field-preplans/assets/[assetId]/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(upload,/field_preplans\.manage_attachments/);
  assert.match(upload,/image\/jpeg/);assert.match(upload,/application\/pdf/);assert.match(upload,/25\*1024\*1024/);
  assert.match(upload,/field-preplans\/\$\{preplanId\}\/assets/);
  assert.match(download,/field_preplans\.view/);assert.match(download,/private, no-store/);assert.match(download,/nosniff/);
  assert.doesNotMatch(upload,/NEXT_PUBLIC_/);assert.doesNotMatch(download,/NEXT_PUBLIC_/);
});

test("Operational panel sends the attachment field names accepted by the API",async()=>{
  const panel=await readFile(new URL("../app/preplans/operational-panel.tsx",import.meta.url),"utf8");
  assert.match(panel,/upload\.set\("assetType",form\.assetCategory\)/);
  assert.match(panel,/upload\.set\("asset",assetFile\)/);
  assert.doesNotMatch(panel,/upload\.set\("file",assetFile\)/);
});
