import { createHmac, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The server-side document store (DOCUMENTS_DIR). Needs the same DOCUMENTS_DIR and IP_HASH_SALT the server runs with,
 * so it is skipped when they are not set (CI leaves uploads off). Links are minted here the way the app mints them.
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // no .env.local
}
const DIR = process.env.DOCUMENTS_DIR;
const SALT = process.env.DOCUMENTS_SECRET ?? process.env.IP_HASH_SALT ?? "";
test.skip(!DIR || SALT.length < 16, "Set DOCUMENTS_DIR and IP_HASH_SALT (as the server runs with them) to test the document store");

// Mirrors lib/storage-local.ts: a key derived from the secret, then an HMAC over the encoded claim
const KEY = createHmac("sha256", SALT).update("ecram-documents-signing-key-v1").digest();
const sign = (claim: object) => {
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${body}.${createHmac("sha256", KEY).update(`documents:${body}`).digest("base64url")}`;
};
const folder = randomUUID();
const claim = (name: string, over: object = {}) => ({ op: "put", path: `${folder}/${name}`, exp: Date.now() + 3_600_000, ...over });
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 1)]);

test.afterAll(async () => {
  if (DIR) await rm(path.join(DIR, folder), { recursive: true, force: true });
});

test("an upload link stores one genuine file, once", async ({ request }) => {
  const url = `/api/documents/upload?t=${sign(claim("vog.pdf"))}`;
  expect((await request.put(url, { headers: { "content-type": "application/pdf" }, data: pdf })).status()).toBe(200);
  expect((await request.put(url, { headers: { "content-type": "application/pdf" }, data: pdf })).status()).toBe(409);
});

test("wrong type, disguised files, oversized files and bad links are refused", async ({ request }) => {
  const put = (token: string, type: string, data: Buffer) =>
    request.put(`/api/documents/upload?t=${token}`, { headers: { "content-type": type }, data });
  expect((await put(sign(claim("a.pdf")), "image/png", pdf)).status()).toBe(415);
  expect((await put(sign(claim("b.pdf")), "application/pdf", Buffer.from("<html>not a pdf</html>"))).status()).toBe(415);
  expect((await put(sign(claim("c.pdf")), "application/pdf", Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(5 * 1024 * 1024 + 10)]))).status()).toBe(413);
  expect((await put(sign(claim("d.pdf", { exp: Date.now() - 1000 })), "application/pdf", pdf)).status()).toBe(403);
  expect((await put(sign(claim("e.pdf")).replace(/.$/, "x"), "application/pdf", pdf)).status()).toBe(403);
  expect((await put(sign({ op: "put", path: "../../etc/x.pdf", exp: Date.now() + 60_000 }), "application/pdf", pdf)).status()).toBe(403);
});

test("a download link opens nothing without an admin session", async ({ request }) => {
  const token = sign({ op: "get", path: `${folder}/vog.pdf`, exp: Date.now() + 60_000 });
  expect((await request.get(`/api/documents/file?t=${token}`)).status()).toBe(401);
});
