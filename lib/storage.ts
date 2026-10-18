import "server-only";
import { readFile } from "node:fs/promises";
import * as local from "./storage-local";
import * as supabase from "./storage-supabase";

/**
 * Where driver-application documents live. Two backends, same five functions:
 *
 * - `DOCUMENTS_DIR` set → files on this server's disk (lib/storage-local.ts). The browser uploads to the app's
 *   own /api/documents routes and admins open files through them.
 * - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set → Supabase Storage (lib/storage-supabase.ts).
 * - neither → document uploads are switched off and the form simply doesn't ask for them.
 *
 * If both are set, the server's own disk wins.
 */
const backend = () => (local.configured() ? local : supabase.configured() ? supabase : null);

export const DOCUMENTS_BUCKET = supabase.DOCUMENTS_BUCKET;
export type { StoredFile } from "./storage-supabase";

export const storageConfigured = () => backend() !== null;

/** A URL the browser can PUT one file to, once, within two hours. */
export const signedUploadUrl = (path: string) => backend()!.signedUploadUrl(path);

/** A link to view a file, valid for `expiresIn` seconds. */
export const signedDownloadUrl = (path: string, expiresIn?: number) => backend()!.signedDownloadUrl(path, expiresIn);

/**
 * One stored file's bytes, read by the server itself (for a download it has already authorised), or null if there is
 * none. Only for small files such as invoices: the whole file is read into memory.
 */
export async function readStoredFile(path: string): Promise<Uint8Array | null> {
  const b = backend();
  if (!b) return null;
  if (b === local) {
    const absolute = local.absolutePath(path);
    return absolute ? readFile(absolute).catch(() => null) : null;
  }
  const res = await fetch(await supabase.signedDownloadUrl(path, 60)).catch(() => null);
  return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

/** Files directly inside `folder`. */
export const listFiles = (folder: string) => backend()!.listFiles(folder);

/** Deletes files; failures are logged, not thrown, so they never block the caller. */
export const removeFiles = (paths: string[]) => (backend() ? backend()!.removeFiles(paths) : Promise.resolve());
