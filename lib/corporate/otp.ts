import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Rules for the Corporate Partner area, in one place so the emails, copy and checks agree. */
export const CODE_MINUTES = 10;
/** How long a sign-in lasts. It ends sooner on sign-out, and every sign-in ends when the password is changed. */
export const SESSION_DAYS = 7;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
/** At most this many codes per visitor address in the window, and per contact per hour. */
export const IP_LIMIT = { max: 3, windowMinutes: 15 };
export const CONTACT_LIMIT = { max: 3, windowMinutes: 60 };

/** Failed sign-ins before the account pauses, and for how long. The pause is invisible to the visitor (see login). */
export const LOGIN_LOCK = { max: 5, minutes: 15 };
/** Sign-in attempts per visitor address, counted before any password is hashed (hashing is the expensive part). */
export const LOGIN_IP_LIMIT = { max: 20, windowMs: 15 * 60_000 };
/** Password-reset requests per visitor address; the reset form does not write anything for an unknown address. */
export const RESET_IP_LIMIT = { max: 10, windowMs: 15 * 60_000 };

export const CHALLENGE_COOKIE = "ee_cp_challenge";
/** The signed-in session. The name is older than accounts: it first held the 24-hour access after a code. */
export const ACCESS_COOKIE = "ee_cp_access";

/** Which wording of the marketing consent the person agreed to; bump when the form's text changes. */
export const CONSENT_TEXT_VERSION = "2026-10";

/**
 * A six-digit code has only a million possibilities, so a stored plain hash could be reversed in an
 * instant by anyone who read the database. Keying it with a server secret means the stored value is
 * useless without that secret. Fails closed: with no secret configured, nothing can be issued.
 */
function secret() {
  const value = process.env.CORPORATE_OTP_SECRET;
  if (!value || value.length < 16) {
    throw new Error("CORPORATE_OTP_SECRET is not set (at least 16 characters). Generate one with: openssl rand -hex 32");
  }
  return value;
}

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Bound to the challenge id, so a code from one challenge can never satisfy another. */
export const codeHmac = (challengeId: string, code: string) =>
  createHmac("sha256", secret()).update(`${challengeId}:${code}`).digest("hex");

export function codeMatches(challengeId: string, code: string, storedHex: string) {
  const expected = Buffer.from(codeHmac(challengeId, code), "hex");
  const stored = Buffer.from(storedHex, "hex");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
