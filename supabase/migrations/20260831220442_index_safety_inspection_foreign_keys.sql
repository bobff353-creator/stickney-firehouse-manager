SET search_path TO firehouse, public;

CREATE INDEX IF NOT EXISTS safety_results_template_item_idx
  ON safety_inspection_results(template_item_id);

CREATE INDEX IF NOT EXISTS safety_inspections_inspector_idx
  ON safety_inspections(inspector_employee_id);
