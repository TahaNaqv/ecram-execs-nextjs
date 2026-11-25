"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { fillTemplate } from "@/lib/admin/template-tags";
import { TEMPLATE_DEFAULTS, templateOverride } from "@/lib/admin/templates";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { formatCurrency } from "@/lib/pricing/rates";

const BOOKKEEPER = "bookkeeper@ecramexecs.com";

function saved() {
  revalidatePath("/admin/introducers");
  refresh();
}

export async function addIntroducer(formData: FormData) {
  await requireArea("/admin/introducers");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return;
  const email = String(formData.get("email") ?? "").trim();
  const percent = Number(formData.get("percent") ?? 10);
  await db.insert(schema.introducers).values({
    name,
    email: email.includes("@") ? email : null,
    commissionPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 10,
  });
  saved();
}

export async function updateIntroducer(formData: FormData) {
  await requireArea("/admin/introducers");
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
  saved();
}

export async function deleteIntroducer(formData: FormData) {
  await requireArea("/admin/introducers");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.delete(schema.introducers).where(eq(schema.introducers.id, id));
  saved();
}

/** Sends the edited invoice request and records when it went out. The bookkeeper is always copied. */
export async function emailIntroducer(formData: FormData) {
  const admin = await requireArea("/admin/introducers");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [person] = await db.select().from(schema.introducers).where(eq(schema.introducers.id, id)).limit(1);
  if (!person?.email) return;
  const amount = formatCurrency(Number(formData.get("cents") ?? 0) / 100);
  const netTotal = formatCurrency(Number(formData.get("netCents") ?? 0) / 100);
  const monthYear = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());
  const tags = { amount, name: person.name, introducerName: person.name, monthYear, commission: amount, netTotal };
  const savedTemplate = await templateOverride("introducer_commission");
  const fallback = TEMPLATE_DEFAULTS.introducer_commission;
  const subject = String(formData.get("subject") ?? "").trim() || fillTemplate(savedTemplate?.subject ?? fallback.subject, tags);
  const body = String(formData.get("body") ?? "").trim() || fillTemplate(savedTemplate?.body ?? fallback.body, tags);
  const extra = process.env.BOOKKEEPER_EMAIL?.trim().toLowerCase();
  const cc = [BOOKKEEPER, ...(extra && extra !== BOOKKEEPER ? [extra] : [])];
  const { sendIntroducerCommission } = await import("@/lib/email");
  await sendIntroducerCommission({ to: person.email, subject, body, cc, fromName: admin.name });
  await db.update(schema.introducers).set({ lastInvoiceRequestedAt: new Date() }).where(eq(schema.introducers.id, id));
  saved();
}
