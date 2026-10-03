-- 003_postcard_audio_and_storage.sql
-- Migration: Add storage paths and audio metadata to bloomroom.postcards

-- 1. Allow image_base64 to be nullable for new records stored in Supabase Storage
ALTER TABLE bloomroom.postcards
  ALTER COLUMN image_base64 DROP NOT NULL;

-- 2. Update existing image_base64 constraint to allow null
ALTER TABLE bloomroom.postcards
  DROP CONSTRAINT IF EXISTS postcard_image_limit;

ALTER TABLE bloomroom.postcards
  ADD CONSTRAINT postcard_image_limit
  CHECK (image_base64 IS NULL OR length(image_base64) <= 1400000);

-- 3. Add storage path and audio metadata columns
ALTER TABLE bloomroom.postcards
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_mime VARCHAR(64),
  ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS audio_size_bytes INTEGER;

-- 4. Constraint: every postcard must have at least one valid image source (storage path or base64)
ALTER TABLE bloomroom.postcards
  DROP CONSTRAINT IF EXISTS postcard_has_image;

ALTER TABLE bloomroom.postcards
  ADD CONSTRAINT postcard_has_image
  CHECK (image_path IS NOT NULL OR image_base64 IS NOT NULL);

-- 5. Constraint: audio file size max 2MB (2097152 bytes) and duration max 45s (with tolerance)
ALTER TABLE bloomroom.postcards
  DROP CONSTRAINT IF EXISTS postcard_audio_limit;

ALTER TABLE bloomroom.postcards
  ADD CONSTRAINT postcard_audio_limit
  CHECK (
    (audio_path IS NULL AND audio_mime IS NULL AND audio_duration_ms IS NULL AND audio_size_bytes IS NULL)
    OR
    (audio_path IS NOT NULL AND (audio_size_bytes IS NULL OR audio_size_bytes <= 2097152) AND (audio_duration_ms IS NULL OR audio_duration_ms <= 45000))
  );

-- 6. Index for postcards with audio (fast querying if needed)
CREATE INDEX IF NOT EXISTS idx_postcards_audio_path ON bloomroom.postcards(audio_path) WHERE audio_path IS NOT NULL;
