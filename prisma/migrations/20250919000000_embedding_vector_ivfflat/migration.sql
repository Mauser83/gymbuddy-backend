-- Former sql/002_embedding_vector_ivfflat.sql — included here so migrate deploy
-- applies the pgvector tuning automatically.

-- Ensure the column uses a fixed-dimension pgvector type (vector(512))
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

CREATE INDEX IF NOT EXISTS imageembedding_model_idx
  ON "ImageEmbedding" ("scope_type", "gym_id", "modelVendor", "modelName", "modelVersion");