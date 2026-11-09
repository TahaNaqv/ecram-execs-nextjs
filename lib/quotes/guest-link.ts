import { createHmac, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";

/**
 * The private link to a booking for a visitor with no account (the client, 8 Nov 2026): every booking is reviewed by hand,
 * and the visitor follows the review, talks with the booking manager and pays on that page. The key is derived from the
 * booking's id with a server secret, so the same link can be rebuilt for any later email, and a reference alone opens nothing.
 * Rotating the secret retires every link at once.
 */
function secret(): string {
  const value = process.env.GUEST_LINK_SECRET || process.env.IP_HASH_SALT;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV !== "production") return "dev-guest-link-secret-fallback-32chars";
  throw new Error("GUEST_LINK_SECRET is not set (at least 16 characters). Generate one with: openssl rand -hex 32");
}

/** The key in a booking's link: 32 characters of an HMAC of its id. */
export function guestKey(id: string): string {
  return createHmac("sha256", secret()).update(`guest:${id}`).digest("base64url").slice(0, 32);
}

/** Whether a key from a link belongs to this booking, compared in constant time. */
export function verifyGuestKey(id: string, key: unknown): boolean {
  if (typeof key !== "string" || key.length !== 32) return false;
  const expected = Buffer.from(guestKey(id));
  const given = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The page's path in a language, for the browser (no host): /en/booking?ref=EE-XXXXXX&k=… */
export function guestPath(booking: { id: string; reference: string }, locale: Locale): string {
  return `${localizedPath("/booking", locale)}?ref=${encodeURIComponent(booking.reference)}&k=${guestKey(booking.id)}`;
}

/** The full link, for an email. */
export function guestUrl(booking: { id: string; reference: string }, locale: Locale): string {
  return `${process.env.SITE_URL ?? ""}${guestPath(booking, locale)}`;
}
