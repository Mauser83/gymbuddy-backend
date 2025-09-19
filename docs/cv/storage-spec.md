📦 GymBuddy CV Storage & CDN Specification
Version: v1.0
Owner: CV/ML Engineering
Purpose: Define the canonical storage bucket layout, object key patterns, and lifecycle rules for computer vision assets. This spec is authoritative for all upload, training, and reference image handling.

1. Buckets
   Bucket Path Prefix Description Visibility / Access
   public/golden/ Permanent, curated reference images used for inference and gold-standard labeling. Public CDN; read-only to clients; write restricted.
   public/training/ Model training images, cleaned/approved. Retained for a defined training history window. Public CDN; read-only to clients; write restricted.
   private/uploads/ Raw uploaded images awaiting processing, review, or training assignment. Short-lived. Private (auth required); read/write for uploader.

Note: “Public” here means publicly accessible via CDN URL; not necessarily indexed/discoverable.

2. Object Key Patterns
   Golden Reference Images
   php-template
   Copy
   Edit
   public/golden/<equipmentId>/<YYYY>/<MM>/<uuid>.jpg
   <equipmentId>: Integer PK from Equipment table.

<YYYY> / <MM>: UTC year/month of creation.

<uuid>: Random UUIDv4 for uniqueness.

Training Set Images
php-template
Copy
Edit
public/training/<equipmentId>/<YYYY>/<MM>/<uuid>.jpg
Same rules as golden, but for training datasets.

Private Uploads
php-template
Copy
Edit
private/uploads/<gymId>/<YYYY>/<MM>/<uuid>.jpg
<gymId>: Integer PK from Gym table.

<YYYY> / <MM>: UTC year/month of upload.

<uuid>: Random UUIDv4.

3. Lifecycle & Retention
   Bucket Retention Policy
   private/uploads/ Expire after N days (default: 30). Auto-delete unprocessed uploads.
   public/training/ Retain for M months (default: 12). Rolling window for reproducible training.
   public/golden/ Retain permanently unless superseded by explicit replacement.

Lifecycle rules are enforced via the storage provider’s lifecycle management and may also be double-enforced in the processing pipeline.

4. Implementation Notes
   File format & MIME:

Accept image/jpeg and image/heic at upload time.

HEIC images (e.g., from iPhones) are automatically converted server-side to JPEG (image/jpeg) for consistency.

After conversion, normalize all file extensions to .jpg.

Compression & size normalization:

Target output size ≈ 2–3 MB for typical full-res phone shots (JPEG quality ≈ 85%).

Reject any file > 15 MB after conversion to guard against oversized uploads.

Metadata handling:

Strip all EXIF metadata except for orientation before public storage.

UUID generation:

All filenames use server-generated UUIDv4, never client-supplied names.

Path consistency:

Paths must match exactly; no uppercase, spaces, or non-URL-safe chars.
