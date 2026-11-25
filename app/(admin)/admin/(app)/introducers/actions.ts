"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { fillTemplate } from "@/lib/admin/template-tags";
import { templateOverride } from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { formatCurrency } from "@/lib/pricing/rates";

export async function addIntroducer(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return;
  const email = String(formData.get("email") ?? "").trim();
  const percent = Number(formData.get("percent") ?? 10);
  await db.insert(schema.introducers).values({
    name,
    email: email.includes("@") ? email : null,
    commissionPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 10,
  });
  refresh();
}

export async function updateIntroducer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2) return;
  const email = String(formData.get("email") ?? "").trim();
  const percent = Number(formData.get("percent") ?? 10);
  await db
    .update(schema.introducers)
    .set({
      name,
      email: email.includes("@") ? email : null,
      commissionPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 10,
      active: formData.get("active") === "on",
    })
    .where(eq(schema.introducers.id, id));
  refresh();
}

export async function deleteIntroducer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.delete(schema.introducers).where(eq(schema.introducers.id, id));
  refresh();
}

export async function emailIntroducer(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const [person] = await db.select().from(schema.introducers).where(eq(schema.introducers.id, id)).limit(1);
  if (!person?.email) return;
  const amount = formatCurrency(Number(formData.get("cents") ?? 0) / 100);
  const saved = await templateOverride("introducer_commission");
  const subject = fillTemplate(saved?.subject ?? "Your commission for this month", { amount, name: person.name });
  const body = fillTemplate(saved?.body ?? "Your commission this month is {amount}. Please email an invoice for that amount to the bookkeeper.", { amount, name: person.name });
  const bookkeeper = process.env.BOOKKEEPER_EMAIL?.trim();
  const { sendIntroducerCommission } = await import("@/lib/email");
  await sendIntroducerCommission({ to: person.email, subject, body, cc: bookkeeper ? [bookkeeper] : [], fromName: admin.name });
}
