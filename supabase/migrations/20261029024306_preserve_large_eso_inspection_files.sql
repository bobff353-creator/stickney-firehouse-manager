-- Reuse verified ESO originals without reducing image quality. New uploads remain capped at 4 MiB.
ALTER TABLE firehouse.fire_inspection_pilot_files
 ADD CONSTRAINT fire_inspection_pilot_files_source_size_check
 CHECK (size_bytes > 0 AND (size_bytes <= 4194304 OR (object_key LIKE 'eso:%' AND size_bytes <= 16777216))) NOT VALID;
ALTER TABLE firehouse.fire_inspection_pilot_files VALIDATE CONSTRAINT fire_inspection_pilot_files_source_size_check;
ALTER TABLE firehouse.fire_inspection_pilot_files DROP CONSTRAINT fire_inspection_pilot_files_size_bytes_check;
