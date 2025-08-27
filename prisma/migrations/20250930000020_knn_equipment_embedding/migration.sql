CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EquipmentImage"      ADD COLUMN IF NOT EXISTS embedding vector(512);
ALTER TABLE "GymEquipmentImage"   ADD COLUMN IF NOT EXISTS embedding vector(512);

CREATE INDEX IF NOT EXISTS equipmentimage_embedding_cos
  ON "EquipmentImage"    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS gymequipmentimage_embedding_cos
  ON "GymEquipmentImage" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);