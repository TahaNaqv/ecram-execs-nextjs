"use server";

import { emailAdminReset } from "@/lib/email";
import { ensureInitialStaff, issuePasswordReset, consumePasswordReset } from "@/lib/admin/staff";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

/** The page is open to anyone signed out, so reset emails are limited: per visitor, and per address (no inbox flooding). */
const PER_VISITOR = { max: 5, windowMs: 15 * 60_000 };
const PER_EMAIL = { max: 3, windowMs: 60 * 60_000 };
const ATTEMPTS = { max: 10, windowMs: 15 * 60_000 };

export type ForgotState = { sent?: boolean };
export type ResetState = { ok?: boolean; error?: boolean };

export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  await ensureInitialStaff();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const { ipHash } = await visitor();
  // Over a limit the answer is the same "sent", so the page never tells which addresses have an account
  if (!withinLimit(`admin-reset:${ipHash}`, PER_VISITOR.max, PER_VISITOR.windowMs)) return { sent: true };
  if (email.includes("@") && withinLimit(`admin-reset-email:${email}`, PER_EMAIL.max, PER_EMAIL.windowMs)) {
    const issued = await issuePasswordReset(email);
    if (issued) {
      const origin = process.env.SITE_URL ?? "";
      await emailAdminReset(issued, `${origin}/admin/reset?token=${encodeURIComponent(issued.token)}`);
    }
  }
  return { sent: true };
}

export async function applyReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 12 || !token) return { error: true };
  const { ipHash } = await visitor();
  if (!withinLimit(`admin-reset-apply:${ipHash}`, ATTEMPTS.max, ATTEMPTS.windowMs)) return { error: true };
  const ok = await consumePasswordReset(token, password);
  return ok ? { ok: true } : { error: true };
}
