import assert from "node:assert/strict";
import { newTotpSecret, totpUri, verifyTotp } from "../lib/auth/totp.ts";
import { createHmac } from "node:crypto";

const secret = newTotpSecret();
assert.match(secret, /^[A-Z2-7]+$/);
const uri = totpUri("Owner@EcramExecs.com", secret);
assert.match(uri, /^otpauth:\/\/totp\/Ecram%20Execs:owner%40ecramexecs\.com\?/);
assert.match(uri, /algorithm=SHA1/);
assert.match(uri, new RegExp(`secret=${secret}`));

const now = Date.UTC(2026, 10, 25, 12, 0, 10);
assert.equal(verifyTotp(secret, "000000", now), false);
assert.equal(verifyTotp(secret, "12 34 56", now), false);

function codeAt(key: string, at: number) {
  const counter = Math.floor(at / 30_000);
  let matched = "";
  for (let skew = -2; skew <= 2; skew++) {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter + skew));
    const clean = key.replace(/\s/g, "").toUpperCase();
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
      value = (value << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    const hmac = createHmac("sha1", Buffer.from(out)).update(msg).digest();
    const offset = hmac[hmac.length - 1]! & 0xf;
    const bin = hmac.readUInt32BE(offset) & 0x7fffffff;
    matched = String(bin % 1_000_000).padStart(6, "0");
    if (skew === 0) break;
  }
  return matched;
}

const current = codeAt(secret, now);
assert.equal(verifyTotp(secret, current, now), true);
assert.equal(verifyTotp(secret, `${current.slice(0, 3)} ${current.slice(3)}`, now + 25_000), true);
assert.equal(verifyTotp(secret, current, now + 60_000), false);
assert.equal(verifyTotp(`  ${secret.toLowerCase()}  `, current, now), true);

assert.equal(verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082", 59_000), true);
assert.equal(verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287 082", 59_000), true);
assert.equal(verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "081804", 1_111_111_109_000), true);

console.log("totp checks passed");
