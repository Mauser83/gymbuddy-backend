-- Add scope_type and gym_id columns with backfill
ALTER TABLE "ImageEmbedding"
  ADD COLUMN "scope_type" TEXT,
  ADD COLUMN "gym_id" INTEGER;

-- Backfill from legacy scope column
UPDATE "ImageEmbedding"
SET "scope_type" = CASE
    WHEN scope = 'GLOBAL' THEN 'GLOBAL'
    WHEN scope LIKE 'GYM:%' THEN 'GYM'
    ELSE NULL
  END,
    "gym_id" = CASE
    WHEN scope LIKE 'GYM:%' THEN (split_part(scope, ':', 2))::INT
    ELSE NULL
  END;

-- Constraint ensuring consistency
ALTER TABLE "ImageEmbedding"
  ADD CONSTRAINT "ImageEmbedding_scope_type_gym_id_ck" CHECK (("scope_type" = 'GLOBAL' AND "gym_id" IS NULL) OR ("scope_type" = 'GYM' AND "gym_id" IS NOT NULL));

-- Indexes
CREATE INDEX "ImageEmbedding_scope_type_idx" ON "ImageEmbedding"("scope_type");
CREATE INDEX "ImageEmbedding_gym_id_idx" ON "ImageEmbedding"("gym_id");

-- Replace global vector index with partial ones per scope
DROP INDEX IF EXISTS imageembedding_ivfflat_cosine;
CREATE INDEX imageembedding_global_vec_idx
  ON "ImageEmbedding" USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "scope_type" = 'GLOBAL';
CREATE INDEX imageembedding_gym_vec_idx
  ON "ImageEmbedding" USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "scope_type" = 'GYM';