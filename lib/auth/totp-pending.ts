import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PENDING_COOKIE = "ee_admin_totp_pending";
const PENDING_MINUTES = 30;

function mac(sessionToken: string, secret: string) {
  return createHmac("sha256", sessionToken).update(secret).digest("base64url");
}

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Holds the unconfirmed authenticator secret on this sign-in until the code matches. */
export async function savePendingTotp(secret: string) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const clean = secret.replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
  store.set(PENDING_COOKIE, `${clean}.${mac(token, clean)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MINUTES * 60,
  });
}

/** The pending secret for the current session, or null when it is missing or was not issued for this sign-in. */
export async function readPendingTotp() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const raw = store.get(PENDING_COOKIE)?.value;
  if (!token || !raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const secret = raw.slice(0, dot);
  if (!/^[A-Z2-7]+$/.test(secret) || !same(raw.slice(dot + 1), mac(token, secret))) return null;
  return secret;
}

export async function clearPendingTotp() {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}
