-- Additive only: preserve original objects, captions, relationships and history.
-- Filename matches the production migration history entry applied through Supabase.
-- Existing firehouse RLS + authenticated server boundary remain unchanged.
ALTER TABLE firehouse.field_preplan_photos
 ADD COLUMN IF NOT EXISTS illustrations text NOT NULL DEFAULT '[]',
 ADD COLUMN IF NOT EXISTS illustration_version integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN firehouse.field_preplan_photos.illustrations IS
 'Illustration-only A-D photo marks in normalized image coordinates. Never map features or operational assets.';
