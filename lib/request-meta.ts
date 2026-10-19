import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

/** Short human-friendly reference, e.g. EE-7K3Q9P */
export const makeReference = (prefix: string) =>
  `${prefix}-` + Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");

/** Salted hash of the visitor's IP (for rate limiting) and their user-agent. */
export async function visitor() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "ecram-execs"}:${ip}`)
    .digest("hex");
  return { ipHash, userAgent: h.get("user-agent")?.slice(0, 300) };
}

/** Postgres unique-violation, e.g. a reference collision */
export const isUniqueViolation = (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === "23505";
