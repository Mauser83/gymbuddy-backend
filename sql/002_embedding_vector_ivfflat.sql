-- 002_embedding_vector_ivfflat.sql

-- Ensure the column uses a fixed-dimension pgvector type
-- (Prisma defined the column as "vector", here we set vector(1536))
ALTER TABLE "ImageEmbedding"
  ALTER COLUMN "embeddingVec" TYPE vector(1536);

-- Recommended for cosine similarity with most CLIP/OpenAI embeddings
CREATE INDEX IF NOT EXISTS imageembedding_ivfflat_cosine
  ON "ImageEmbedding"
  USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100);

-- Optional: a smaller, general-purpose HNSW index if you need better recall on smaller corpora
-- CREATE INDEX IF NOT EXISTS imageembedding_hnsw_cosine
--   ON "ImageEmbedding"
--   USING hnsw ("embeddingVec" vector_cosine_ops);

-- Helpful filter index by model signature (speeds up queries when you pin a model)
CREATE INDEX IF NOT EXISTS imageembedding_model_idx
  ON "ImageEmbedding" ("scope", "modelVendor", "modelName", "modelVersion");