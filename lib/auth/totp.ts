import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function normalizeBase32(text: string) {
  return text.replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
}

function decodeBase32(text: string) {
  const clean = normalizeBase32(text);
  if (!/^[A-Z2-7]+$/.test(clean)) return Buffer.alloc(0);
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) return Buffer.alloc(0);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secrets issued now are base32. Older rows were stored as base64url, which authenticator apps still scan. */
function secretKey(secret: string) {
  const clean = secret.replace(/[\s-]/g, "");
  if (/^[A-Za-z2-7]+=*$/.test(clean)) return decodeBase32(clean);
  const body = clean.replace(/-/g, "+").replace(/_/g, "/");
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  const decoded = Buffer.from(padded, "base64");
  return decoded.length > 0 ? decoded : decodeBase32(clean);
}

/** A new authenticator secret, base32, which authenticator apps can scan. */
export function newTotpSecret() {
  return encodeBase32(randomBytes(20));
}

function hotp(secret: Buffer, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 1_000_000).padStart(6, "0");
}

/** True when the 6-digit code matches this 30-second window, or one step either side (±30 seconds). Spaces in the code are ignored. */
export function verifyTotp(secret: string, token: string, now = Date.now()) {
  const cleaned = token.replace(/\s+/g, "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const key = secretKey(secret);
  if (key.length < 10) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((skew) => hotp(key, counter + skew) === cleaned);
}

export function totpUri(email: string, secret: string) {
  const issuer = "Ecram Execs";
  const key = secret.replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email.trim().toLowerCase())}`;
  const query = [`secret=${encodeURIComponent(key)}`, `issuer=${encodeURIComponent(issuer)}`, "algorithm=SHA1", "digits=6", "period=30"].join("&");
  return `otpauth://totp/${label}?${query}`;
}
