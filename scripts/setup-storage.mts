// Create (or update) the private Supabase Storage bucket for driver application documents.
//   npm run storage:setup
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (or the environment). Safe to re-run.
// The size and type limits are enforced by Supabase itself, so they also apply to direct browser uploads.
// Keep them in step with DOCUMENT_TYPES and MAX_DOCUMENT_BYTES in lib/partners/criteria.ts.

const BUCKET = "driver-documents";
const settings = {
  public: false,
  file_size_limit: 5 * 1024 * 1024,
  allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
};

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (add them to .env.local).");
  process.exit(1);
}

const headers = { apikey: key, ...(key.startsWith("eyJ") && { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" };
const existing = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers });
const res = await fetch(existing.ok ? `${url}/storage/v1/bucket/${BUCKET}` : `${url}/storage/v1/bucket`, {
  method: existing.ok ? "PUT" : "POST",
  headers,
  body: JSON.stringify({ id: BUCKET, name: BUCKET, ...settings }),
});
if (!res.ok) {
  console.error(`Could not ${existing.ok ? "update" : "create"} the bucket: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`Bucket "${BUCKET}" ${existing.ok ? "updated" : "created"}: private, PDF/JPG/PNG, max 5 MB per file.`);
