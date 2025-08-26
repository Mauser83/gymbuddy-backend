-- 001_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- sanity check
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';