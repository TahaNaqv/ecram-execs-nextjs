import { randomUUID } from "node:crypto";
import { link, mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/partners/criteria";
import { absolutePath, extensionOf, hasRoomFor, verify } from "@/lib/storage-local";

/**
 * Receives one driver-application document, on the one-time link the application form was given
 * (see lib/storage-local.ts). Everything is checked here, on the server, because nothing the browser says can
 * be trusted: the link's signature and expiry, the file type, the size, what the bytes actually are, and that the
 * disk has room.
 *
 * The body is streamed to a temporary file and only published, atomically, once it is complete and checked: a
 * dropped connection or a full disk never leaves a half-written file in the place a real document would go,
 * and nothing is buffered in memory.
 */

/** Real files begin with these bytes; a renamed .exe or HTML page does not. */
const MAGIC: Record<string, number[]> = { pdf: [0x25, 0x50, 0x44, 0x46], jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47] };

const reply = (status: number, error: string) => Response.json({ error }, { status });

export async function PUT(request: Request) {
  const claim = verify(new URL(request.url).searchParams.get("t"), "put");
  if (!claim) return reply(403, "invalid_or_expired_link");

  const target = absolutePath(claim.path);
  const ext = extensionOf(claim.path);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!target || DOCUMENT_TYPES[type] !== ext) return reply(415, "unsupported_type");

  const declared = Number(request.headers.get("content-length"));
  if (!declared || declared > MAX_DOCUMENT_BYTES) return reply(413, "too_large");
  if (!request.body) return reply(400, "empty");
  if (!(await hasRoomFor(declared))) return reply(507, "storage_full");

  const temporary = `${target}.part-${randomUUID()}`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    handle = await open(temporary, "wx", 0o600);

    const reader = request.body.getReader();
    let received = 0;
    let head = Buffer.alloc(0);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      // Whatever Content-Length claimed, never accept more than the limit
      if (received > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        return reply(413, "too_large");
      }
      // Check the file's first bytes as soon as they have arrived, before anything is kept
      if (head.length < 4) {
        head = Buffer.concat([head, value.subarray(0, 4 - head.length)]);
        if (head.length >= MAGIC[ext].length && !MAGIC[ext].every((byte, i) => head[i] === byte)) {
          await reader.cancel();
          return reply(415, `not_a_${ext}`);
        }
      }
      await handle.write(value);
    }
    if (received < MAGIC[ext].length || !MAGIC[ext].every((byte, i) => head[i] === byte)) return reply(415, `not_a_${ext}`);

    await handle.close();
    handle = undefined;
    // A hard link fails if the target exists, so — unlike rename — it can never replace a file already stored
    await link(temporary, target);
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return reply(409, "already_uploaded");
    console.error("[documents] could not store upload", err);
    return reply(500, "storage_error");
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}
