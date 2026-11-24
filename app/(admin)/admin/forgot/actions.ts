"use server";

import { emailAdminReset } from "@/lib/email";
import { ensureInitialStaff, issuePasswordReset, consumePasswordReset } from "@/lib/admin/staff";

export type ForgotState = { sent?: boolean };
export type ResetState = { ok?: boolean; error?: boolean };

export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  await ensureInitialStaff();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@")) {
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
  const ok = await consumePasswordReset(token, password);
  return ok ? { ok: true } : { error: true };
}
