-- 002_embedding_vector_ivfflat.sql

-- Ensure the column uses a fixed-dimension pgvector type
-- (Prisma defined the column as "vector", here we set vector(1536))
ALTER TABLE "ImageEmbedding"
  ALTER COLUMN "embeddingVec" TYPE vector(512);

-- Partial ivfflat indexes by scope
CREATE INDEX IF NOT EXISTS imageembedding_global_vec_idx
  ON "ImageEmbedding"
  USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "scope_type" = 'GLOBAL';

CREATE INDEX IF NOT EXISTS imageembedding_gym_vec_idx
  ON "ImageEmbedding"
  USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "scope_type" = 'GYM';

-- Helpful filter index by model signature (speeds up queries when you pin a model)
CREATE INDEX IF NOT EXISTS imageembedding_model_idx
  ON "ImageEmbedding" ("scope_type", "gym_id", "modelVendor", "modelName", "modelVersion");