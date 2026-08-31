SET search_path TO firehouse, public;

ALTER TABLE safety_inspection_templates
  ADD COLUMN IF NOT EXISTS location_options text NOT NULL DEFAULT '[]';

ALTER TABLE safety_inspections
  ADD COLUMN IF NOT EXISTS inspection_location text NOT NULL DEFAULT '';

INSERT INTO safety_inspection_templates(
  id, slug, title, description, cadence, category, location_options
)
VALUES
  ('monthly-public-works-extinguishers','public-works-monthly-fire-extinguishers','Public Works Monthly Fire Extinguisher Inspection','Monthly inspection of the extinguishers assigned to the Public Works garage, spare storage, vehicles, and gas pump.','monthly','Fire extinguishers','[]'),
  ('monthly-pump-station-extinguishers','pump-station-monthly-fire-extinguishers','Pump Station Monthly Fire Extinguisher Inspection','Monthly inspection of the extinguishers at the Pump Station first floor, basement, and generator building.','monthly','Fire extinguishers','[]'),
  ('monthly-village-hall-police-extinguishers','village-hall-police-monthly-fire-extinguishers','Village Hall and Police Department Fire Extinguisher Inspection','Monthly extinguisher and AED readiness inspection for the Police Department, basement, and Village Hall.','monthly','Fire extinguishers','[]'),
  ('weekly-eyewash-inspection','weekly-eye-wash-inspection','Weekly Eye Wash Inspection','Weekly operational check of the five department eyewash locations.','weekly','Safety equipment','[]'),
  ('monthly-general-safety-inspection','monthly-safety-inspection','Monthly Safety Inspection','Comprehensive monthly safety inspection covering work practices, postings, fire control, housekeeping, electrical, sanitation, equipment, and building systems.','monthly','Facility safety','["Fire Department","Village Hall","Police station"]')
ON CONFLICT(id) DO UPDATE SET
  slug=excluded.slug,
  title=excluded.title,
  description=excluded.description,
  cadence=excluded.cadence,
  category=excluded.category,
  location_options=excluded.location_options;

INSERT INTO safety_inspection_template_items(
  id, template_id, section_name, label, equipment_type, required, sort_order
)
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
  ('pw-ext-024','monthly-public-works-extinguishers','Gas pump','Gas pump extinguisher','10 lb dry chemical',0,240),
  ('pump-ext-001','monthly-pump-station-extinguishers','1st Floor','By front door','10 lb dry chemical',1,10),
  ('pump-ext-002','monthly-pump-station-extinguishers','Basement','By stairs','10 lb CO₂',1,20),
  ('pump-ext-003','monthly-pump-station-extinguishers','Generator Building','By door','10 lb dry chemical',1,30),
  ('vhpd-ext-001','monthly-village-hall-police-extinguishers','1st Floor PD','Hall by Dispatch','10 lb dry chemical',1,10),
  ('vhpd-ext-002','monthly-village-hall-police-extinguishers','1st Floor PD','Lock up','10 lb dry chemical',1,20),
  ('vhpd-ext-003','monthly-village-hall-police-extinguishers','1st Floor PD','PD Garage','10 lb dry chemical',1,30),
  ('vhpd-ext-004','monthly-village-hall-police-extinguishers','1st Floor PD','Hall by Detective''s office','10 lb dry chemical',1,40),
  ('vhpd-ext-005','monthly-village-hall-police-extinguishers','1st Floor PD','Men''s room','10 lb dry chemical',1,50),
  ('vhpd-ext-006','monthly-village-hall-police-extinguishers','1st Floor PD','By back door','10 lb dry chemical',1,60),
  ('vhpd-ext-007','monthly-village-hall-police-extinguishers','1st Floor PD','Zoll AED monitor','AED',1,70),
  ('vhpd-ext-008','monthly-village-hall-police-extinguishers','Basement','Electrical room','10 lb dry chemical',1,80),
  ('vhpd-ext-009','monthly-village-hall-police-extinguishers','Basement','Gun Range','10 lb dry chemical',1,90),
  ('vhpd-ext-010','monthly-village-hall-police-extinguishers','Basement','Maintenance room — front','10 lb dry chemical',1,100),
  ('vhpd-ext-011','monthly-village-hall-police-extinguishers','Basement','Maintenance room — back','10 lb CO₂',1,110),
  ('vhpd-ext-012','monthly-village-hall-police-extinguishers','Village Hall','Hall by storage rooms','10 lb dry chemical',1,120),
  ('vhpd-ext-013','monthly-village-hall-police-extinguishers','Village Hall','Outside clerk''s office','10 lb dry chemical',1,130),
  ('vhpd-ext-014','monthly-village-hall-police-extinguishers','Village Hall','Clerk office closet','10 lb dry chemical',1,140),
  ('vhpd-ext-015','monthly-village-hall-police-extinguishers','Village Hall','Outside break room','5 lb dry chemical',1,150),
  ('vhpd-ext-016','monthly-village-hall-police-extinguishers','Village Hall','Outside trustee''s office','5 lb dry chemical',1,160),
  ('eyewash-001','weekly-eyewash-inspection','Location','Fire Department','Apparatus floor',1,10),
  ('eyewash-002','weekly-eyewash-inspection','Location','Police Department','Hall by bathrooms',1,20),
  ('eyewash-003','weekly-eyewash-inspection','Location','Public Works','Under stairs',1,30),
  ('eyewash-004','weekly-eyewash-inspection','Location','Police Department','Gun Range basement',1,40),
  ('eyewash-005','weekly-eyewash-inspection','Location','Pump Station','Main room',1,50),
  ('monthly-safe-001','monthly-general-safety-inspection','Safe Work Practice','Employees in good health and dressed in uniform','',1,10),
  ('monthly-safe-002','monthly-general-safety-inspection','Safe Work Practice','Proper protective equipment used as required','',1,20),
  ('monthly-safe-003','monthly-general-safety-inspection','Safe Work Practice','Employee workplace clean and orderly; free of spills and oil','',1,30),
  ('monthly-safe-004','monthly-general-safety-inspection','Safe Work Practice','Safe operating procedures followed when moving vehicles','',1,40),
  ('monthly-safe-005','monthly-general-safety-inspection','Safe Work Practice','Ventilating devices used when engines run inside','',1,50),
  ('monthly-safe-006','monthly-general-safety-inspection','Safe Work Practice','Compressed gas cylinders stored upright and properly secured','',1,60),
  ('monthly-safe-007','monthly-general-safety-inspection','Safe Work Practice','Public access restricted','',1,70),
  ('monthly-safe-008','monthly-general-safety-inspection','Safe Work Practice','Equipment and machine guards in place','',1,80),
  ('monthly-safe-009','monthly-general-safety-inspection','Safe Work Practice','Tools and machines used properly','',1,90),
  ('monthly-safe-010','monthly-general-safety-inspection','Safe Work Practice','Tools and machines properly maintained','',1,100),
  ('monthly-safe-011','monthly-general-safety-inspection','Safe Work Practice','Flame- or spark-producing operations isolated from flammable liquids','',1,110),
  ('monthly-safe-012','monthly-general-safety-inspection','Safe Work Practice','Flammables kept in proper containers and stored properly','',1,120),
  ('monthly-safe-013','monthly-general-safety-inspection','Safe Work Practice','Flammable liquid spills cleaned up immediately','',1,130),
  ('monthly-safe-014','monthly-general-safety-inspection','Bulletin Board & Records','OSHA labor poster posted','',1,140),
  ('monthly-safe-015','monthly-general-safety-inspection','Bulletin Board & Records','State labor poster posted','',1,150),
  ('monthly-safe-016','monthly-general-safety-inspection','Bulletin Board & Records','State Department of Unemployment poster posted','',1,160),
  ('monthly-safe-017','monthly-general-safety-inspection','Bulletin Board & Records','Equal Employment Opportunity poster posted','',1,170),
  ('monthly-safe-018','monthly-general-safety-inspection','Bulletin Board & Records','State sexual harassment notice poster posted','',1,180),
  ('monthly-safe-019','monthly-general-safety-inspection','Bulletin Board & Records','Family Medical Leave Act poster posted','',1,190),
  ('monthly-safe-020','monthly-general-safety-inspection','Bulletin Board & Records','Minimum wage poster posted','',1,200),
  ('monthly-safe-021','monthly-general-safety-inspection','Bulletin Board & Records','Medical network and work-related injury processing procedure poster posted','',1,210),
  ('monthly-safe-022','monthly-general-safety-inspection','Bulletin Board & Records','Discrimination in employment poster posted','',1,220),
  ('monthly-safe-023','monthly-general-safety-inspection','Office / Administration Area','Employees in good health and dressed properly','',1,230),
  ('monthly-safe-024','monthly-general-safety-inspection','Office / Administration Area','Equipment used properly','',1,240),
  ('monthly-safe-025','monthly-general-safety-inspection','Office / Administration Area','Housekeeping kept up','',1,250),
  ('monthly-safe-026','monthly-general-safety-inspection','Office / Administration Area','Unattended files and desk drawers closed','',1,260),
  ('monthly-safe-027','monthly-general-safety-inspection','Office / Administration Area','Only one file drawer open at a time','',1,270),
  ('monthly-safe-028','monthly-general-safety-inspection','Fire Control','Fire doors closed and free of obstacles','',1,280),
  ('monthly-safe-029','monthly-general-safety-inspection','Fire Control','Exits clearly marked and non-exits marked','',1,290),
  ('monthly-safe-030','monthly-general-safety-inspection','Fire Control','Fire instructions posted','',1,300),
  ('monthly-safe-031','monthly-general-safety-inspection','Fire Control','Emergency evacuation plan posted','',1,310),
  ('monthly-safe-032','monthly-general-safety-inspection','Fire Control','Fire extinguishers in good condition, at proper height, and inspected monthly','',1,320),
  ('monthly-safe-033','monthly-general-safety-inspection','Fire Control','Hazardous materials located away from heat, flame, water, and damage','',1,330),
  ('monthly-safe-034','monthly-general-safety-inspection','Fire Control','Hazardous operations isolated, including welding, grinding, and cutting','',1,340),
  ('monthly-safe-035','monthly-general-safety-inspection','Housekeeping — All Areas','Floors clean, free of defects, grease, and oil spills','',1,350),
  ('monthly-safe-036','monthly-general-safety-inspection','Housekeeping — All Areas','Trash containers sufficient in number and not overflowing','',1,360),
  ('monthly-safe-037','monthly-general-safety-inspection','Housekeeping — All Areas','Permanent ladders firmly attached and in good condition','',1,370),
  ('monthly-safe-038','monthly-general-safety-inspection','Housekeeping — All Areas','Ladders stored properly and free of defects','',1,380),
  ('monthly-safe-039','monthly-general-safety-inspection','Housekeeping — All Areas','Stairs clear and in good condition','',1,390),
  ('monthly-safe-040','monthly-general-safety-inspection','Housekeeping — All Areas','Storage areas neatly kept','',1,400),
  ('monthly-safe-041','monthly-general-safety-inspection','Housekeeping — All Areas','Cleaning supplies readily available','',1,410),
  ('monthly-safe-042','monthly-general-safety-inspection','Exterior and Parking Areas','Parking surface free of holes and debris','',1,420),
  ('monthly-safe-043','monthly-general-safety-inspection','Exterior and Parking Areas','Sidewalks free of trip hazards','',1,430),
  ('monthly-safe-044','monthly-general-safety-inspection','Exterior and Parking Areas','Fuel island clean and posted No Smoking','',1,440),
  ('monthly-safe-045','monthly-general-safety-inspection','Exterior and Parking Areas','Fire extinguisher available at fuel island','',1,450),
  ('monthly-safe-046','monthly-general-safety-inspection','Electrical','Permanent wiring boxes, switches, outlets, and lights secure','',1,460),
  ('monthly-safe-047','monthly-general-safety-inspection','Electrical','36-inch clearance maintained around electrical panel','',1,470),
  ('monthly-safe-048','monthly-general-safety-inspection','Electrical','Breakers and fuse panels properly maintained and closed','',1,480),
  ('monthly-safe-049','monthly-general-safety-inspection','Electrical','Extension cords, portable lights, and tool wiring free of cuts or damage','',1,490),
  ('monthly-safe-050','monthly-general-safety-inspection','Electrical','Protective devices for equipment in use','',1,500),
  ('monthly-safe-051','monthly-general-safety-inspection','Electrical','Electrical outlet covers in place','',1,510),
  ('monthly-safe-052','monthly-general-safety-inspection','Electrical','GFCI outlets tested and operational','',1,520),
  ('monthly-safe-053','monthly-general-safety-inspection','Electrical','Extension cords used only temporarily','',1,530),
  ('monthly-safe-054','monthly-general-safety-inspection','Electrical','Lighting sufficient and free from glare','',1,540),
  ('monthly-safe-055','monthly-general-safety-inspection','Health & Sanitation','Food area clean and maintained','',1,550),
  ('monthly-safe-056','monthly-general-safety-inspection','Health & Sanitation','Bathrooms clean and properly maintained','',1,560),
  ('monthly-safe-057','monthly-general-safety-inspection','Health & Sanitation','Noise protection present and used properly','',1,570),
  ('monthly-safe-058','monthly-general-safety-inspection','Health & Sanitation','Ventilation adequate, including special venting as needed','',1,580),
  ('monthly-safe-059','monthly-general-safety-inspection','Health & Sanitation','Protective equipment adequate, neatly stored, accessible, and used','',1,590),
  ('monthly-safe-060','monthly-general-safety-inspection','Health & Sanitation','Eyewash station present and in good working condition','',1,600),
  ('monthly-safe-061','monthly-general-safety-inspection','Machines, Equipment & Tools','Electrical equipment and tools protected by grounding or insulation','',1,610),
  ('monthly-safe-062','monthly-general-safety-inspection','Machines, Equipment & Tools','Moving parts within seven feet of floor enclosed','',1,620),
  ('monthly-safe-063','monthly-general-safety-inspection','Machines, Equipment & Tools','Machines guarded at point of operation','',1,630),
  ('monthly-safe-064','monthly-general-safety-inspection','Machines, Equipment & Tools','Hand tools in good working condition','',1,640),
  ('monthly-safe-065','monthly-general-safety-inspection','Machines, Equipment & Tools','Hoists and jacks marked for weight rating','',1,650),
  ('monthly-safe-066','monthly-general-safety-inspection','Machines, Equipment & Tools','Pre-use inspections conducted for all hoists and jacks','',1,660),
  ('monthly-safe-067','monthly-general-safety-inspection','Machines, Equipment & Tools','Hoists, ropes, slings, jacks, and hooks in good working condition','',1,670),
  ('monthly-safe-068','monthly-general-safety-inspection','Miscellaneous Items','Exit lighting checked and operational','',1,680),
  ('monthly-safe-069','monthly-general-safety-inspection','Miscellaneous Items','Emergency lighting tested and operational','',1,690),
  ('monthly-safe-070','monthly-general-safety-inspection','Miscellaneous Items','Hood and duct system inspected and operational','',1,700),
  ('monthly-safe-071','monthly-general-safety-inspection','Miscellaneous Items','Sprinkler control valve open','',1,710),
  ('monthly-safe-072','monthly-general-safety-inspection','Miscellaneous Items','Riser clear of obstructions','',1,720),
  ('monthly-safe-073','monthly-general-safety-inspection','Miscellaneous Items','Sprinkler heads unobstructed and free of debris','',1,730),
  ('monthly-safe-074','monthly-general-safety-inspection','Miscellaneous Items','Fire Department connection unobstructed and in good condition','',1,740),
  ('monthly-safe-075','monthly-general-safety-inspection','Miscellaneous Items','Hydrant accessible and operating properly','',1,750),
  ('monthly-safe-076','monthly-general-safety-inspection','Miscellaneous Items','Door bells operate','',1,760),
  ('monthly-safe-077','monthly-general-safety-inspection','Miscellaneous Items','Bay door reverse sensor operational','',1,770),
  ('monthly-safe-078','monthly-general-safety-inspection','Miscellaneous Items','Ceiling tiles intact and in place','',1,780),
  ('monthly-safe-079','monthly-general-safety-inspection','Miscellaneous Items','Eyewash station bottles intact and not expired','',1,790),
  ('monthly-safe-080','monthly-general-safety-inspection','Miscellaneous Items','Hot water tank relief valve operational','',1,800)
ON CONFLICT(id) DO UPDATE SET
  template_id=excluded.template_id,
  section_name=excluded.section_name,
  label=excluded.label,
  equipment_type=excluded.equipment_type,
  required=excluded.required,
  sort_order=excluded.sort_order;

DO $$
DECLARE
  missing_columns text[];
  template_count integer;
  item_count integer;
BEGIN
  SELECT array_agg(required.table_name || '.' || required.column_name)
  INTO missing_columns
  FROM (
    VALUES
      ('safety_inspection_templates', 'location_options'),
      ('safety_inspections', 'inspection_location')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS portal_column
    WHERE portal_column.table_schema = 'firehouse'
      AND portal_column.table_name = required.table_name
      AND portal_column.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Required safety inspection columns are missing: %',
      array_to_string(missing_columns, ', ');
  END IF;

  SELECT count(*) INTO template_count
  FROM safety_inspection_templates
  WHERE id IN (
    'monthly-public-works-extinguishers',
    'monthly-pump-station-extinguishers',
    'monthly-village-hall-police-extinguishers',
    'weekly-eyewash-inspection',
    'monthly-general-safety-inspection'
  );

  SELECT count(*) INTO item_count
  FROM safety_inspection_template_items
  WHERE template_id IN (
    'monthly-public-works-extinguishers',
    'monthly-pump-station-extinguishers',
    'monthly-village-hall-police-extinguishers',
    'weekly-eyewash-inspection',
    'monthly-general-safety-inspection'
  );

  IF template_count <> 5 OR item_count <> 128 THEN
    RAISE EXCEPTION 'Safety inspection library expected 5 templates and 128 checkpoints; found % templates and % checkpoints',
      template_count, item_count;
  END IF;

  INSERT INTO system_meta(key, value, updated_at)
  VALUES (
    'runtime_bootstrap_version',
    'stickney-runtime-bootstrap-2026-08-31-safety-inspection-library-v2',
    now()
  )
  ON CONFLICT(key) DO UPDATE SET
    value=excluded.value,
    updated_at=excluded.updated_at;
END $$;
