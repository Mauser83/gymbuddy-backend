-- Wrap everything transactionally (Prisma runs in a tx by default, but explicit is fine)
BEGIN;

-- =========================
-- GymEquipmentImage changes
-- =========================
-- Add new columns if missing
ALTER TABLE "public"."GymEquipmentImage"
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "storageKey" TEXT;

-- imageId may already be nullable; this is safe if it's already NULLable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'GymEquipmentImage'
      AND column_name = 'imageId'
  ) THEN
    -- DROP NOT NULL only if it's currently NOT NULL
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'GymEquipmentImage'
        AND a.attname = 'imageId'
        AND a.attnotnull = true
    ) THEN
      EXECUTE 'ALTER TABLE "public"."GymEquipmentImage" ALTER COLUMN "imageId" DROP NOT NULL';
    END IF;
  END IF;
END $$;

-- Handle the gymEquipmentId column ONLY if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'GymEquipmentImage' AND column_name = 'gymEquipmentId'
  ) THEN
    -- Drop any FK on gymEquipmentId if present (quoted or unquoted name)
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'GymEquipmentImage'
        AND c.conname IN ('GymEquipmentImage_gymEquipmentId_fkey', 'gymequipmentimage_gymequipmentid_fkey')
    ) THEN
      -- Try both naming variants safely
      BEGIN
        EXECUTE 'ALTER TABLE "public"."GymEquipmentImage" DROP CONSTRAINT "GymEquipmentImage_gymEquipmentId_fkey"';
      EXCEPTION WHEN undefined_object THEN
        -- ignore
      END;
      BEGIN
        EXECUTE 'ALTER TABLE "public"."GymEquipmentImage" DROP CONSTRAINT gymequipmentimage_gymequipmentid_fkey';
      EXCEPTION WHEN undefined_object THEN
        -- ignore
      END;
    END IF;

    -- Make the column nullable if it was NOT NULL
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'GymEquipmentImage'
        AND a.attname = 'gymEquipmentId'
        AND a.attnotnull = true
    ) THEN
      EXECUTE 'ALTER TABLE "public"."GymEquipmentImage" ALTER COLUMN "gymEquipmentId" DROP NOT NULL';
    END IF;

    -- Re-add FK to GymEquipment(id) if it's not already there
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'GymEquipmentImage'
        AND c.conname IN ('GymEquipmentImage_gymEquipmentId_fkey', 'gymequipmentimage_gymequipmentid_fkey')
    ) THEN
      EXECUTE 'ALTER TABLE "public"."GymEquipmentImage"
               ADD CONSTRAINT "GymEquipmentImage_gymEquipmentId_fkey"
               FOREIGN KEY ("gymEquipmentId") REFERENCES "public"."GymEquipment"("id")
               ON DELETE SET NULL ON UPDATE CASCADE';
    END IF;
  END IF;
END $$;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS "GymEquipmentImage_sha256_idx" ON "public"."GymEquipmentImage"("sha256");

-- ===================
-- ImageEmbedding side
-- ===================
ALTER TABLE "public"."ImageEmbedding"
  ADD COLUMN IF NOT EXISTS "gymImageId" TEXT;

DO $$
BEGIN
  -- make ImageEmbedding.imageId nullable if it isn't already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ImageEmbedding' AND column_name='imageId'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'ImageEmbedding'
        AND a.attname = 'imageId'
        AND a.attnotnull = true
    ) THEN
      EXECUTE 'ALTER TABLE "public"."ImageEmbedding" ALTER COLUMN "imageId" DROP NOT NULL';
    END IF;
  END IF;
END $$;

-- Add FK from ImageEmbedding.gymImageId -> GymEquipmentImage(id) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'ImageEmbedding'
      AND c.conname = 'ImageEmbedding_gymImageId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."ImageEmbedding"
             ADD CONSTRAINT "ImageEmbedding_gymImageId_fkey"
             FOREIGN KEY ("gymImageId") REFERENCES "public"."GymEquipmentImage"("id")
             ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- Indexes from the migration (adapt names to your originals if they differ)
CREATE UNIQUE INDEX IF NOT EXISTS "ImageEmbedding_gymImageId_scope_modelVendor_modelName_modelVersion_idx"
  ON "public"."ImageEmbedding"("gymImageId","scope","modelVendor","modelName","modelVersion");

-- ===============
-- ImageQueue side
-- ===============
ALTER TABLE "public"."ImageQueue"
  ADD COLUMN IF NOT EXISTS "storageKey" TEXT;

CREATE INDEX IF NOT EXISTS "ImageQueue_storageKey_idx" ON "public"."ImageQueue"("storageKey");

COMMIT;