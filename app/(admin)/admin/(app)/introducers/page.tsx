import type { Metadata } from "next";
import { Suspense } from "react";
import { asc, isNull, sql } from "drizzle-orm";
import { introducerBoard } from "@/lib/admin/introducers";
import { TEMPLATE_DEFAULTS, templateOverride } from "@/lib/admin/templates";
import { formatTimestamp } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatCurrency } from "@/lib/pricing/rates";
import { PageBody } from "../../_components/ui";
import { IntroducerBoard, type IntroducerView, type PartnerOption } from "./introducer-table";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.introducers ?? "Introducers"} — Ecram Execs` };
}

export default function IntroducersPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <Introducers />
    </Suspense>
  );
}

async function Introducers() {
  await requireAdmin();
  const [rows, savedTemplate, details, partnerRows] = await Promise.all([
    introducerBoard(),
    templateOverride("introducer_commission"),
    db
      .select({ id: schema.introducers.id, phone: schema.introducers.phone, company: schema.introducers.company, notes: schema.introducers.notes })
      .from(schema.introducers),
    db
      .select({
        id: schema.corporateContacts.id,
        company: schema.corporateContacts.companyName,
        name: schema.corporateContacts.name,
        email: schema.corporateContacts.email,
        introducerId: schema.corporateContacts.introducerId,
      })
      .from(schema.corporateContacts)
      .where(isNull(schema.corporateContacts.archivedAt))
      .orderBy(asc(sql`coalesce(nullif(${schema.corporateContacts.companyName}, ''), ${schema.corporateContacts.name})`)),
  ]);
  const template = savedTemplate ?? TEMPLATE_DEFAULTS.introducer_commission;
  const extra = new Map(details.map((row) => [row.id, row]));
  const monthYear = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());
  const views: IntroducerView[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: extra.get(row.id)?.phone ?? null,
    company: extra.get(row.id)?.company ?? null,
    notes: extra.get(row.id)?.notes ?? null,
    commissionPercent: row.commissionPercent,
    active: row.active,
    partners: row.partners,
    monthNet: formatCurrency(row.monthNetCents / 100),
    monthCommission: formatCurrency(row.monthCommissionCents / 100),
    monthCommissionCents: row.monthCommissionCents,
    monthNetCents: row.monthNetCents,
    monthYear,
    notified: row.lastInvoiceRequestedAt ? formatTimestamp(row.lastInvoiceRequestedAt) : null,
  }));
  const partners: PartnerOption[] = partnerRows.map((row) => ({
    id: row.id,
    company: row.company?.trim() || null,
    name: row.name,
    email: row.email,
    introducerId: row.introducerId,
  }));
  return (
    <PageBody>
      <IntroducerBoard rows={views} partners={partners} subjectTemplate={template.subject} bodyTemplate={template.body} />
    </PageBody>
  );
}
