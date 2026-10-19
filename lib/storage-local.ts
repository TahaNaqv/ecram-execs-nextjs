import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readdir, rm, rmdir, stat, statfs } from "node:fs/promises";
import path from "node:path";
import type { StoredFile } from "./storage-supabase";

/**
 * Documents on this server's disk, under DOCUMENTS_DIR (create it owned by the app user, mode 700, outside the
 * web root and outside the git checkout so a deploy never touches it). Files are <folder-uuid>/<name>.<ext>.
 *
 * The browser never sees a path on disk. Uploads and downloads go through the app's /api/documents routes using
 * short-lived signed tokens, so the "signed URL" idea of the Supabase backend carries over unchanged and the
 * application form needs no changes.
 */

export const configured = () => !!process.env.DOCUMENTS_DIR;

const root = () => path.resolve(process.env.DOCUMENTS_DIR!);

/** The only shape of path that is ever read or written: a UUID folder and a plain file name. Nothing else gets near the disk. */
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z]{1,20}\.(pdf|jpg|png)$/;
const FOLDER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const CONTENT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };
export const extensionOf = (relative: string) => relative.split(".").pop()!;

/** The file's absolute path, or null if `relative` isn't a path this store would ever have created. */
export function absolutePath(relative: string) {
  if (!PATH_RE.test(relative)) return null;
  const absolute = path.join(root(), relative);
  return absolute.startsWith(root() + path.sep) ? absolute : null;
}

// ── Signed tokens ────────────────────────────────────────────────────────────────────────────────────────────
function secret() {
  const value = process.env.DOCUMENTS_SECRET ?? process.env.IP_HASH_SALT;
  if (!value || value.length < 16) {
    throw new Error("Set IP_HASH_SALT (or DOCUMENTS_SECRET), at least 16 characters, to sign document links");
  }
  return value;
}

type Claim = { op: "put" | "get"; path: string; exp: number };

// A key of its own, derived from the secret, so signing document links is separate from every other use of IP_HASH_SALT
const signingKey = () => createHmac("sha256", secret()).update("ecram-documents-signing-key-v1").digest();
const signature = (body: string) => createHmac("sha256", signingKey()).update(`documents:${body}`).digest("base64url");

function sign(claim: Claim) {
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${body}.${signature(body)}`;
}

/** The claim inside a token, if the token is genuine, unexpired and for this operation. */
export function verify(token: string | null, op: Claim["op"]): Claim | null {
  if (!token) return null;
  const [body, given] = token.split(".");
  if (!body || !given) return null;
  const expected = Buffer.from(signature(body));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString()) as Claim;
    if (claim.op !== op || typeof claim.path !== "string" || !PATH_RE.test(claim.path) || claim.exp < Date.now()) return null;
    return claim;
  } catch {
    return null;
  }
}

/**
 * Whether the disk can take `bytes` more without dropping below a safety margin (default 2 GB, DOCUMENTS_MIN_FREE_MB).
 * The documents share a disk with the database, so a flood of uploads must stop short of starving it.
 */
export async function hasRoomFor(bytes: number) {
  const margin = Number(process.env.DOCUMENTS_MIN_FREE_MB ?? 2048) * 1024 * 1024;
  try {
    const info = await statfs(root());
    return info.bavail * info.bsize - bytes > margin;
  } catch {
    return false; // the folder is missing or unreadable: don't pretend there is room
  }
}

// ── The same five functions as the Supabase backend ───────────────────────────────────────────────────────────

/** A URL the browser can PUT one file to, once, within two hours. */
export async function signedUploadUrl(relative: string) {
  if (!PATH_RE.test(relative)) throw new Error(`Refusing to sign upload for ${relative}`);
  return `/api/documents/upload?t=${sign({ op: "put", path: relative, exp: Date.now() + 2 * 60 * 60_000 })}`;
}

/** A link to view a file, valid for `expiresIn` seconds. It also requires an admin session to open. */
export async function signedDownloadUrl(relative: string, expiresIn = 600) {
  if (!PATH_RE.test(relative)) throw new Error(`Refusing to sign download for ${relative}`);
  return `/api/documents/file?t=${sign({ op: "get", path: relative, exp: Date.now() + expiresIn * 1000 })}`;
}

/** Files directly inside `folder`. */
export async function listFiles(folder: string): Promise<StoredFile[]> {
  if (!FOLDER_RE.test(folder)) return [];
  const dir = path.join(root(), folder);
  const names = await readdir(dir).catch(() => [] as string[]);
  const files: StoredFile[] = [];
  for (const name of names) {
    const info = await stat(path.join(dir, name)).catch(() => null);
    if (info?.isFile()) files.push({ name, size: info.size, contentType: CONTENT_TYPES[extensionOf(name)] ?? "" });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/** Deletes files (and their folder once empty); failures are logged, not thrown, so they never block the caller. */
export async function removeFiles(paths: string[]) {
  for (const relative of paths) {
    const absolute = absolutePath(relative);
    if (!absolute) continue;
    try {
      await rm(absolute, { force: true });
      await rmdir(path.dirname(absolute)).catch(() => {}); // only succeeds when the folder is empty
    } catch (err) {
      console.error(`[storage] could not delete ${relative}`, err);
    }
  }
}
