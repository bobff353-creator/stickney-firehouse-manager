import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Preplan 2.0 migration preserves legacy records and creates normalized operational tables",async()=>{
  const migration=await readFile(new URL("../supabase/migrations/20260820212759_add_operational_preplan_v2.sql",import.meta.url),"utf8");
  for(const table of ["field_preplan_levels","field_preplan_feature_levels","field_preplan_spaces","field_preplan_alerts","field_preplan_hazmat","field_preplan_hazmat_zones","field_preplan_annotations","field_preplan_assets","field_preplan_photo_annotations","field_preplan_hose_lays","field_preplan_risk_factors","field_preplan_reviews","field_preplan_revisions","field_preplan_settings"]){
    assert.match(migration,new RegExp(`create table if not exists firehouse\\.${table}`));
  }
  assert.match(migration,/insert into firehouse\.field_preplan_levels[\s\S]+Arrival \/ Ground/);
  assert.match(migration,/publication_status = case[\s\S]+published/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/has_department_access\(\)/);
  assert.match(migration,/allowed_mime_types = array\['image\/jpeg','image\/png','image\/webp','application\/pdf'\]/);
  assert.match(migration,/preplan_schema_version/);
  assert.doesNotMatch(migration,/values\('runtime_bootstrap_version','stickney-runtime-bootstrap-2026-08-20/);
});

test("operational routes use the migration column contract",async()=>{
  const [route,assets,respond]=await Promise.all([
    readFile(new URL("../app/api/field-preplans/operational/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/field-preplans/assets/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/respond/route.ts",import.meta.url),"utf8"),
  ]);
  for(const value of ["display_name name","instructions message","un_na_number unNumber","chemical_name materialName","original_filename filename","mime_type contentType","file_size sizeBytes"])assert.match(route,new RegExp(value));
  assert.match(assets,/category,original_filename,object_key,mime_type,file_size/);
  assert.match(respond,/pin_to_respond=1/);
  assert.match(respond,/COALESCE\(publication_status,'published'\)='published'/);
});
