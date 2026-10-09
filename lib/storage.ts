import "server-only";

// Supabase Storage over its REST API: a private bucket for driver application documents.
// Browsers upload straight to Supabase with one-off signed URLs (Vercel caps request bodies
// at 4.5 MB, too small for four scans); the team opens files through short-lived signed links.
// Create the bucket with `npm run storage:setup`.

export const DOCUMENTS_BUCKET = "driver-documents";

const base = () => `${process.env.SUPABASE_URL?.replace(/\/$/, "")}/storage/v1`;

/** Uploads are skipped (and logged) until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. */
export const storageConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${base()}${path}`, {
    method,
    // New secret keys (sb_secret_…) go in `apikey` only; a legacy service_role JWT also as a bearer token
    headers: { apikey: key, ...(key.startsWith("eyJ") && { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage ${method} ${path.split("?")[0]} → ${res.status} ${await res.text()}`);
  return res.json();
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** A URL the browser can PUT one file to, once, within two hours. */
export async function signedUploadUrl(path: string) {
  const { url } = await call<{ url: string }>("POST", `/object/upload/sign/${DOCUMENTS_BUCKET}/${encodePath(path)}`);
  return `${base()}${url}`;
}

/** A link to view a file, valid for `expiresIn` seconds. */
export async function signedDownloadUrl(path: string, expiresIn = 600) {
  const { signedURL } = await call<{ signedURL: string }>("POST", `/object/sign/${DOCUMENTS_BUCKET}/${encodePath(path)}`, { expiresIn });
  return encodeURI(`${base()}${signedURL}`);
}

export type StoredFile = { name: string; size: number; contentType: string };

/** Files directly inside `folder`. */
export async function listFiles(folder: string): Promise<StoredFile[]> {
  const rows = await call<{ name: string; id: string | null; metadata: { size?: number; mimetype?: string } | null }[]>(
    "POST",
    `/object/list/${DOCUMENTS_BUCKET}`,
    { prefix: folder, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } },
  );
  return rows
    .filter((r) => r.id) // folders have no id
    .map((r) => ({ name: r.name, size: r.metadata?.size ?? 0, contentType: r.metadata?.mimetype ?? "" }));
}

/** Deletes files; failures are logged, not thrown, so they never block the caller. */
export async function removeFiles(paths: string[]) {
  if (!paths.length || !storageConfigured()) return;
  try {
    await call("DELETE", `/object/${DOCUMENTS_BUCKET}`, { prefixes: paths });
  } catch (err) {
    console.error(`[storage] could not delete ${paths.join(", ")}`, err);
  }
}
