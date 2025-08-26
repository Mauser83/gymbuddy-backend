-- Add vocab foreign key columns to EquipmentImage
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "angleId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "heightId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "lightingId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "mirrorId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "distanceId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "sourceId" SMALLINT;
ALTER TABLE "EquipmentImage" ADD COLUMN IF NOT EXISTS "splitId" SMALLINT;

-- Foreign keys for EquipmentImage
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_angleId_fkey"
  FOREIGN KEY ("angleId") REFERENCES "AngleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_heightId_fkey"
  FOREIGN KEY ("heightId") REFERENCES "HeightType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_lightingId_fkey"
  FOREIGN KEY ("lightingId") REFERENCES "LightingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_mirrorId_fkey"
  FOREIGN KEY ("mirrorId") REFERENCES "MirrorType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_distanceId_fkey"
  FOREIGN KEY ("distanceId") REFERENCES "DistanceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SourceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_splitId_fkey"
  FOREIGN KEY ("splitId") REFERENCES "SplitType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for EquipmentImage
CREATE INDEX IF NOT EXISTS "EquipmentImage_angle_height_lighting_idx"
  ON "EquipmentImage" ("angleId", "heightId", "lightingId");
CREATE INDEX IF NOT EXISTS "EquipmentImage_splitId_idx" ON "EquipmentImage" ("splitId");

-- Add vocab foreign key columns to GymEquipmentImage
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "angleId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "heightId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "lightingId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "mirrorId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "distanceId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "sourceId" SMALLINT;
ALTER TABLE "GymEquipmentImage" ADD COLUMN IF NOT EXISTS "splitId" SMALLINT;

-- Foreign keys for GymEquipmentImage
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_angleId_fkey"
  FOREIGN KEY ("angleId") REFERENCES "AngleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_heightId_fkey"
  FOREIGN KEY ("heightId") REFERENCES "HeightType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_lightingId_fkey"
  FOREIGN KEY ("lightingId") REFERENCES "LightingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_mirrorId_fkey"
  FOREIGN KEY ("mirrorId") REFERENCES "MirrorType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_distanceId_fkey"
  FOREIGN KEY ("distanceId") REFERENCES "DistanceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SourceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_splitId_fkey"
  FOREIGN KEY ("splitId") REFERENCES "SplitType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for GymEquipmentImage
CREATE INDEX IF NOT EXISTS "GymEquipmentImage_angle_height_lighting_idx"
  ON "GymEquipmentImage" ("angleId", "heightId", "lightingId");
CREATE INDEX IF NOT EXISTS "GymEquipmentImage_splitId_idx" ON "GymEquipmentImage" ("splitId");
