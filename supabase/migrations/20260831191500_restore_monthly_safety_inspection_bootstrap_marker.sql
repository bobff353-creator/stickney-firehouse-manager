SET search_path TO firehouse, public;

DO $$
DECLARE
  missing_tables text[];
  missing_columns text[];
  extinguisher_item_count integer;
BEGIN
  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO missing_tables
  FROM (
    VALUES
      ('safety_inspection_templates'),
      ('safety_inspection_template_items'),
      ('safety_inspections'),
      ('safety_inspection_results'),
      ('safety_inspection_attachments')
  ) AS required(table_name)
  WHERE to_regclass(format('firehouse.%I', required.table_name)) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Required monthly safety inspection tables are missing: %',
      array_to_string(missing_tables, ', ');
  END IF;

  SELECT array_agg(required.table_name || '.' || required.column_name
    ORDER BY required.table_name, required.column_name)
  INTO missing_columns
  FROM (
    VALUES
      ('safety_inspection_templates', 'slug'),
      ('safety_inspection_template_items', 'equipment_type'),
      ('safety_inspections', 'submitted_at'),
      ('safety_inspection_results', 'result_status'),
      ('safety_inspection_results', 'deficiency_note'),
      ('safety_inspection_attachments', 'object_key')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS portal_column
    WHERE portal_column.table_schema = 'firehouse'
      AND portal_column.table_name = required.table_name
      AND portal_column.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Required monthly safety inspection columns are missing: %',
      array_to_string(missing_columns, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM firehouse.safety_inspection_templates
    WHERE id = 'monthly-public-works-extinguishers'
  ) THEN
    RAISE EXCEPTION 'Public Works extinguisher template is missing; bootstrap marker was not advanced';
  END IF;

  SELECT count(*)
  INTO extinguisher_item_count
  FROM firehouse.safety_inspection_template_items
  WHERE template_id = 'monthly-public-works-extinguishers';

  IF extinguisher_item_count <> 24 THEN
    RAISE EXCEPTION 'Public Works extinguisher template expected 24 items but found %; bootstrap marker was not advanced',
      extinguisher_item_count;
  END IF;

  INSERT INTO firehouse.system_meta(key, value, updated_at)
  VALUES (
    'runtime_bootstrap_version',
    'stickney-runtime-bootstrap-2026-08-31-monthly-safety-inspections-v1',
    now()
  )
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at;
END $$;
