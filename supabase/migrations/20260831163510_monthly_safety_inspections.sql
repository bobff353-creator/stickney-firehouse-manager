SET search_path TO firehouse, public;

CREATE TABLE IF NOT EXISTS safety_inspection_templates (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cadence text NOT NULL DEFAULT 'monthly',
  category text NOT NULL DEFAULT 'Field safety',
  active bigint NOT NULL DEFAULT 1,
  created_by text NOT NULL DEFAULT 'System',
  created_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_by text NOT NULL DEFAULT 'System',
  updated_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS safety_inspection_template_items (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES safety_inspection_templates(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  label text NOT NULL,
  equipment_type text NOT NULL DEFAULT '',
  required bigint NOT NULL DEFAULT 1,
  active bigint NOT NULL DEFAULT 1,
  sort_order bigint NOT NULL DEFAULT 0,
  updated_by text NOT NULL DEFAULT 'System',
  updated_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE INDEX IF NOT EXISTS safety_template_items_order_idx
  ON safety_inspection_template_items(template_id, active, sort_order);

CREATE TABLE IF NOT EXISTS safety_inspections (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES safety_inspection_templates(id),
  inspection_date text NOT NULL,
  inspector_employee_id text REFERENCES employees(id),
  inspector_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','reopened')),
  overall_notes text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  updated_by text NOT NULL,
  updated_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  submitted_by text,
  submitted_at text
);

CREATE INDEX IF NOT EXISTS safety_inspections_template_date_idx
  ON safety_inspections(template_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS safety_inspections_status_date_idx
  ON safety_inspections(status, inspection_date DESC);

CREATE TABLE IF NOT EXISTS safety_inspection_results (
  id text PRIMARY KEY,
  inspection_id text NOT NULL REFERENCES safety_inspections(id) ON DELETE CASCADE,
  template_item_id text NOT NULL REFERENCES safety_inspection_template_items(id),
  snapshot_section_name text NOT NULL,
  snapshot_label text NOT NULL,
  snapshot_equipment_type text NOT NULL DEFAULT '',
  snapshot_required bigint NOT NULL DEFAULT 1,
  snapshot_sort_order bigint NOT NULL DEFAULT 0,
  result_status text NOT NULL DEFAULT 'not_checked' CHECK(result_status IN ('not_checked','pass','deficient','not_applicable')),
  deficiency_note text NOT NULL DEFAULT '',
  corrected_on_site bigint NOT NULL DEFAULT 0,
  updated_by text NOT NULL,
  updated_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  UNIQUE(inspection_id, template_item_id)
);

CREATE INDEX IF NOT EXISTS safety_results_inspection_status_idx
  ON safety_inspection_results(inspection_id, result_status);

CREATE TABLE IF NOT EXISTS safety_inspection_attachments (
  id text PRIMARY KEY,
  inspection_id text NOT NULL REFERENCES safety_inspections(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at text NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE INDEX IF NOT EXISTS safety_attachments_inspection_idx
  ON safety_inspection_attachments(inspection_id, created_at);

INSERT INTO safety_inspection_templates(id,slug,title,description,cadence,category)
VALUES(
  'monthly-public-works-extinguishers',
  'public-works-monthly-fire-extinguishers',
  'Public Works Monthly Fire Extinguisher Inspection',
  'Monthly inspection of the extinguishers assigned to the Public Works garage, spare storage, vehicles, and gas pump.',
  'monthly',
  'Monthly safety inspections'
)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title,
  description=excluded.description,
  cadence=excluded.cadence,
  category=excluded.category;

INSERT INTO safety_inspection_template_items(id,template_id,section_name,label,equipment_type,required,sort_order)
VALUES
  ('pw-ext-001','monthly-public-works-extinguishers','Garage','Hall by men''s room','10 lb dry chemical',1,10),
  ('pw-ext-002','monthly-public-works-extinguishers','Garage','Garage Door #1 — northeast','2.5 lb dry chemical',1,20),
  ('pw-ext-003','monthly-public-works-extinguishers','Garage','Garage Door #2 — west','20 lb dry chemical',1,30),
  ('pw-ext-004','monthly-public-works-extinguishers','Garage','Garage Door #3 — west','10 lb dry chemical',1,40),
  ('pw-ext-005','monthly-public-works-extinguishers','Garage','Garage Door #4 — southeast','10 lb dry chemical',1,50),
  ('pw-ext-006','monthly-public-works-extinguishers','Garage','Garage Door #5 — east by bench','5 lb dry chemical',1,60),
  ('pw-ext-007','monthly-public-works-extinguishers','Spare extinguishers under stairs','Spare 10 lb dry chemical #1','10 lb dry chemical',0,70),
  ('pw-ext-008','monthly-public-works-extinguishers','Spare extinguishers under stairs','Spare 5 lb dry chemical #1','5 lb dry chemical',0,80),
  ('pw-ext-009','monthly-public-works-extinguishers','Spare extinguishers under stairs','Spare 10 lb dry chemical #2','10 lb dry chemical',0,90),
  ('pw-ext-010','monthly-public-works-extinguishers','Spare extinguishers under stairs','Spare 5 lb dry chemical #2','5 lb dry chemical',0,100),
  ('pw-ext-011','monthly-public-works-extinguishers','Spare extinguishers under stairs','Spare cartridge unit','20 lb dry chemical cartridge',0,110),
  ('pw-ext-012','monthly-public-works-extinguishers','Vehicles','Bobcat','5 lb dry chemical',1,120),
  ('pw-ext-013','monthly-public-works-extinguishers','Vehicles','Truck 8 — black pickup','5 lb dry chemical',0,130),
  ('pw-ext-014','monthly-public-works-extinguishers','Vehicles','T-7 — large dump truck','5 lb dry chemical',0,140),
  ('pw-ext-015','monthly-public-works-extinguishers','Vehicles','T-13 — white dump truck','5 lb dry chemical',0,150),
  ('pw-ext-016','monthly-public-works-extinguishers','Vehicles','Komatsu','2.5 lb dry chemical',1,160),
  ('pw-ext-017','monthly-public-works-extinguishers','Vehicles','T-3 — water SUV','5 lb dry chemical',0,170),
  ('pw-ext-018','monthly-public-works-extinguishers','Vehicles','T-12 — black dump truck','5 lb dry chemical',0,180),
  ('pw-ext-019','monthly-public-works-extinguishers','Vehicles','T-5 — red pickup','Size not entered',0,190),
  ('pw-ext-020','monthly-public-works-extinguishers','Vehicles','Truck 1 — garbage truck','5 lb dry chemical',1,200),
  ('pw-ext-021','monthly-public-works-extinguishers','Vehicles','Kubota','2.5 lb dry chemical',0,210),
  ('pw-ext-022','monthly-public-works-extinguishers','Vehicles','T-4 — Dodge pickup','5 lb dry chemical',0,220),
  ('pw-ext-023','monthly-public-works-extinguishers','Vehicles','Sweeper','2.5 lb dry chemical',0,230),
  ('pw-ext-024','monthly-public-works-extinguishers','Gas pump','Gas pump extinguisher','10 lb dry chemical',0,240)
ON CONFLICT(id) DO UPDATE SET
  section_name=excluded.section_name,
  label=excluded.label,
  equipment_type=excluded.equipment_type,
  required=excluded.required,
  sort_order=excluded.sort_order;

INSERT INTO rank_permissions(rank,permission_key,allowed)
SELECT DISTINCT label,'safety_inspections.view',1 FROM pay_scales
ON CONFLICT(rank,permission_key) DO NOTHING;
INSERT INTO rank_permissions(rank,permission_key,allowed)
SELECT DISTINCT label,'safety_inspections.complete',1 FROM pay_scales
ON CONFLICT(rank,permission_key) DO NOTHING;
INSERT INTO rank_permissions(rank,permission_key,allowed)
SELECT DISTINCT label,'safety_inspections.manage',
  CASE WHEN lower(label) LIKE '%chief%' OR lower(label) LIKE '%captain%' OR lower(label) LIKE '%lieutenant%' THEN 1 ELSE 0 END
FROM pay_scales
ON CONFLICT(rank,permission_key) DO NOTHING;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'safety_inspection_templates',
    'safety_inspection_template_items',
    'safety_inspections',
    'safety_inspection_results',
    'safety_inspection_attachments'
  ] LOOP
    EXECUTE format('ALTER TABLE firehouse.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON firehouse.%I', 'stickney_portal_access_' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON firehouse.%I FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()))',
      'stickney_portal_access_' || table_name,
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON firehouse.%I TO authenticated', table_name);
  END LOOP;
END $$;
