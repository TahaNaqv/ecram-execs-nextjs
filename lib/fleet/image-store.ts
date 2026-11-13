import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILES = 8;
const MAX_BYTES = 4 * 1024 * 1024;
const ID_RE = /^[a-z0-9_]{1,64}$/;
const FILE_RE = /^[1-8]\.(jpg|png|webp)$/;

export function fleetImagesRoot() {
  return process.env.FLEET_IMAGES_DIR ? path.resolve(process.env.FLEET_IMAGES_DIR) : path.join(process.cwd(), "data", "fleet-images");
}

export function fleetImageUrl(id: string, file: string) {
  return `/api/fleet-images/${id}/${file}`;
}

function sniff(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

function contentType(file: string) {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Writes the photographs for one vehicle and returns their public paths. An empty list leaves the folder untouched. */
export async function saveFleetImages(id: string, files: File[]): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  if (!ID_RE.test(id)) return { ok: false, error: "invalid" };
  const chosen = files.filter((file) => file.size > 0).slice(0, MAX_FILES);
  if (chosen.length === 0) return { ok: true, urls: [] };
  if (chosen.some((file) => file.size > MAX_BYTES)) return { ok: false, error: "too-large" };

  const prepared: { name: string; bytes: Uint8Array }[] = [];
  for (const file of chosen) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return { ok: false, error: "type" };
    prepared.push({ name: `${prepared.length + 1}.${kind}`, bytes });
  }

  const dir = path.join(fleetImagesRoot(), id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const urls: string[] = [];
  for (const image of prepared) {
    const dest = path.join(dir, image.name);
    if (!dest.startsWith(dir + path.sep)) return { ok: false, error: "invalid" };
    await writeFile(dest, image.bytes);
    urls.push(fleetImageUrl(id, image.name));
  }
  return { ok: true, urls };
}

export async function readFleetImage(id: string, file: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!ID_RE.test(id) || !FILE_RE.test(file)) return null;
  const root = fleetImagesRoot();
  const absolute = path.join(root, id, file);
  if (!absolute.startsWith(root + path.sep)) return null;
  try {
    const bytes = new Uint8Array(await readFile(absolute));
    return { bytes, type: contentType(file) };
  } catch {
    return null;
  }
}

export async function removeFleetImages(id: string) {
  if (!ID_RE.test(id)) return;
  await rm(path.join(fleetImagesRoot(), id), { recursive: true, force: true });
}
