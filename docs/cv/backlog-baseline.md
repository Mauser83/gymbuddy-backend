# Baseline Audit

## Existing Tables

### User

- Primary key: `id` Int autoincrement
- Fields: `username`, `email`, `password`, optional `appRole`, `userRole`, timestamps, reset fields and relations.

### Gym

- Primary key: `id` Int autoincrement
- Core fields: `name`, `description`, country/state/city/address data, coordinates, contact info, `isApproved`, timestamps and relations to creator, trainers and equipment.

### Equipment

- Primary key: `id` Int autoincrement
- Core fields: `name`, optional `description`, `brand`, `manualUrl`, category/subcategory references, timestamps, image and gym relations.

## pgvector Extension

Attempted to query Postgres at `localhost:5432` for the `vector` extension but the server was unreachable, so availability and permissions remain unverified.

## ID Strategy

Current tables use integer autoincrement IDs. Adopt `cuid` identifiers for future schemas to enable globally unique string IDs.

## Timezone Policy

Store and operate on all timestamps in UTC. Prisma's `DateTime` fields already default to UTC; application logic should likewise assume UTC.

## Gaps / Go–No-Go Items

- ❌ Unable to confirm `pgvector` extension; database connection and permissions need verification.
- ✅ Tables `User`, `Gym`, and `Equipment` exist as outlined above.
- 🚧 Pending migration of ID columns from Int to `cuid` once baseline confirmed.
- ✅ Timezone policy set to UTC.

UPDATE:
Got it—thanks for the extra context and the two blockers. Here’s the straight answer and what I’d change in the baseline.

pgvector on Neon (Go)
Neon supports pgvector out of the box—you just need to enable it in your database, then create your ANN index. Quick path:

Enable the extension (run once per DB):

sql
Copy
Edit
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname = 'vector';
Define your column in a migration (Prisma still uses Unsupported("vector")):

prisma
Copy
Edit
model ImageEmbedding {
id String @id @default(cuid())
scope String
imageId String
modelVersion String
dim Int
embeddingVec Unsupported("vector") // set dim via SQL if you want vector(1536)
createdAt DateTime @default(now())

@@index([scope, modelVersion])
}
Add the ANN index in a SQL migration:

sql
Copy
Edit
-- cosine is usually best for CLIP/OpenAI-style embeddings
CREATE INDEX IF NOT EXISTS imageembedding_ivfflat_cosine
ON "ImageEmbedding" USING ivfflat ("embeddingVec" vector_cosine_ops) WITH (lists = 100);
Sanity test:

sql
Copy
Edit
-- returns nearest neighbors (higher = more similar since we invert cosine distance)
SELECT imageId, 1 - (embeddingVec <=> $1) AS cosine_sim
FROM "ImageEmbedding"
WHERE modelVersion = $2
ORDER BY embeddingVec <=> $1
LIMIT 5;
Refs: Neon’s pgvector docs and guide (enable via CREATE EXTENSION, indexing, examples), plus pgvector’s README and Prisma guidance for Unsupported("vector").
Neon
+1
Neon
GitHub
Prisma

➡️ Update in backlog-baseline.md: flip “❌ Unable to confirm pgvector” to GO: “Ready to enable on Neon; add CREATE EXTENSION + IVFFlat index migration.” backlog-baseline

IDs: keep Int PKs in core; use String (cuid) for new rows only (Go)
You do not need to migrate existing Int primary keys. Given your frontend already uses integers, migrating to cuid across User/Gym/Equipment would be high‑blast‑radius with little benefit right now.

Best-of-both plan (smallest diff, matches the MVP tasks):

Keep Int PKs for User, Gym, Equipment (no changes).

Give new tables (EquipmentImage, GymEquipmentImage, ImageEmbedding, ImageQueue) String IDs (cuid) for easy client-side creation and cross‑system uniqueness.

Make foreign keys in the new tables match the existing Int PK types for core entities.

Minimal Prisma tweaks to the task stubs:

prisma
Copy
Edit
// NEW tables keep string IDs (good for uploads/work items)
model EquipmentImage {
id String @id @default(cuid())
equipmentId Int // <— Int to match Equipment.id
// ...
equipment Equipment @relation(fields: [equipmentId], references: [id])
}

model GymEquipmentImage {
id String @id @default(cuid())
gymId Int // <— Int to match Gym.id
equipmentId Int // <— Int to match Equipment.id
capturedByUserId Int?
// ...
gym Gym @relation(fields: [gymId], references: [id])
equipment Equipment @relation(fields: [equipmentId], references: [id])
capturedByUser User? @relation(fields: [capturedByUserId], references: [id])
}
That aligns with the task doc’s intent (string IDs for the image pipeline tables) without forcing a breaking change to your existing models. If later you ever need globally unique IDs for core entities (multi‑region sharding, data merges, public URL hardening), you can consider a v2 migration then. For now, no reason to switch.

➡️ Update in backlog-baseline.md: change “🚧 Pending migration of ID columns from Int to cuid” to NO‑GO (DEFER): “Keep Int IDs on core tables; use cuid only for new image/queue tables; adjust new FKs to Int.”

WHAT WAS DONE:
Awesome—here are the patched stubs you can drop in. I kept core tables on Int PKs and used String @id @default(cuid()) for the new image/queue/embedding tables. Foreign keys back to User, Gym, and Equipment are Int, so your frontend stays happy.

Prisma models (add to schema.prisma)
prisma
Copy
Edit
/// --- NEW + PATCHED TABLES FOR CV PIPELINE ---

// Images uploaded for any equipment (originals, crops, etc.)
model EquipmentImage {
id String @id @default(cuid())
equipmentId Int
uploadedByUserId Int?
// storage + metadata
storageKey String // e.g., "equipment/123/abc.jpg" (S3/Cloud)
mimeType String
width Int
height Int
sha256 String @unique
// optional annotations
note String?
createdAt DateTime @default(now())

// relations
equipment Equipment @relation(fields: [equipmentId], references: [id])
uploadedByUser User? @relation(fields: [uploadedByUserId], references: [id])

// reverse
embeddings ImageEmbedding[]
links GymEquipmentImage[]

@@index([equipmentId, createdAt])
@@index([uploadedByUserId])
}

// Image ↔ Gym+Equipment join (what gym this image was captured at)
model GymEquipmentImage {
id String @id @default(cuid())
gymId Int
equipmentId Int
imageId String
capturedByUserId Int?
capturedAt DateTime @default(now())

// relations
gym Gym @relation(fields: [gymId], references: [id])
equipment Equipment @relation(fields: [equipmentId], references: [id])
image EquipmentImage @relation(fields: [imageId], references: [id], onDelete: Cascade)
capturedByUser User? @relation(fields: [capturedByUserId], references: [id])

@@index([gymId, equipmentId])
@@index([imageId])
@@unique([gymId, equipmentId, imageId])
}

// Vector embeddings (one row per image/model/scope)
model ImageEmbedding {
id String @id @default(cuid())
imageId String
scope String // e.g., "equipment"
modelVendor String // e.g., "openai", "clip", "voyage"
modelName String // e.g., "text-embedding-3-large", "ViT-B/32"
modelVersion String // freeform version string
dim Int
// Prisma does not (yet) have a native pgvector type.
// Use Unsupported("vector"); final type/ops tuned in SQL migrations.
embeddingVec Unsupported("vector")
createdAt DateTime @default(now())

image EquipmentImage @relation(fields: [imageId], references: [id], onDelete: Cascade)

@@unique([imageId, scope, modelVendor, modelName, modelVersion])
@@index([scope, modelVendor, modelName, modelVersion])
@@index([createdAt])
}

// Light-weight work queue for (re)processing images (crop, embed, etc.)
enum ImageJobStatus {
pending
processing
succeeded
failed
}

model ImageQueue {
id String @id @default(cuid())
imageId String
jobType String // e.g., "embed", "augment", "classify"
status ImageJobStatus @default(pending)
priority Int @default(0)
attempts Int @default(0)
lastError String?
scheduledAt DateTime? // for delayed jobs
startedAt DateTime?
finishedAt DateTime?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

image EquipmentImage @relation(fields: [imageId], references: [id], onDelete: Cascade)

@@index([status, priority, scheduledAt])
@@index([jobType, status])
@@index([imageId])
}
Notes
• Keep your existing User, Gym, and Equipment models with Int primary keys—no changes needed.
• Only the new pipeline tables use String IDs.
• Unsupported("vector") is intentional; we finalize the vector(…) + ANN index with raw SQL migrations below.

SQL migration 001 — enable pgvector
Create a migration like 001_enable_pgvector.sql and run it once per database:

sql
Copy
Edit
-- 001_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- sanity check
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SQL migration 002 — shape the vector column + ANN index
Adjust the column subtype (set dims) and add an IVFFlat index with cosine ops. Change 1536 if your model differs.

sql
Copy
Edit
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
-- ON "ImageEmbedding"
-- USING hnsw ("embeddingVec" vector_cosine_ops);

-- Helpful filter index by model signature (speeds up queries when you pin a model)
CREATE INDEX IF NOT EXISTS imageembedding_model_idx
ON "ImageEmbedding" ("scope", "modelVendor", "modelName", "modelVersion");
Example query — nearest neighbors (cosine)
sql
Copy
Edit
-- :embedVec := your query vector as an array literal cast, e.g. '[0.1, 0.2, ...]'::vector
-- :scope, :vendor, :name, :version := strings matching your inserted rows
SELECT
e."imageId",
1 - (e."embeddingVec" <=> :embedVec) AS cosine_similarity
FROM "ImageEmbedding" e
WHERE e."scope" = :scope
AND e."modelVendor" = :vendor
AND e."modelName" = :name
AND e."modelVersion" = :version
ORDER BY e."embeddingVec" <=> :embedVec
LIMIT 10;
If you want me to also spit out a tiny Prisma seed script that: (1) inserts a fake image row, (2) upserts an embedding with a random vector, and (3) runs the similarity query via $queryRaw, I can bundle that too.
