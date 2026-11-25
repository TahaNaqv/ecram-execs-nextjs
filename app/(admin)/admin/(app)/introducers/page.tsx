import type { Metadata } from "next";
import { Suspense } from "react";
import { introducerBoard } from "@/lib/admin/introducers";
import { TEMPLATE_DEFAULTS, templateOverride } from "@/lib/admin/templates";
import { formatTimestamp } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatCurrency } from "@/lib/pricing/rates";
import { btn, Card, PageBody, PageHeader, field } from "../../_components/ui";
import { addIntroducer } from "./actions";
import { IntroducerTable } from "./introducer-table";

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
  const [rows, savedTemplate] = await Promise.all([introducerBoard(), templateOverride("introducer_commission")]);
  const template = savedTemplate ?? TEMPLATE_DEFAULTS.introducer_commission;
  const views = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    commissionPercent: row.commissionPercent,
    active: row.active,
    partners: row.partners,
    monthNet: formatCurrency(row.monthNetCents / 100),
    monthCommission: formatCurrency(row.monthCommissionCents / 100),
    monthCommissionCents: row.monthCommissionCents,
    monthNetCents: row.monthNetCents,
    monthYear: new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date()),
    notified: row.lastInvoiceRequestedAt ? formatTimestamp(row.lastInvoiceRequestedAt) : null,
  }));
  return (
    <PageBody>
      <PageHeader title="Introducers" />
      <Card className="mt-6 overflow-hidden">
        <form action={addIntroducer} className="grid items-end gap-4 border-b border-zinc-100 px-5 py-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(18rem,1.4fr)_7.5rem_auto]">
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-zinc-700">
            Name
            <input name="name" required className={`${field} h-10 w-full`} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[13px] text-zinc-700">
            Email
            <input name="email" type="email" className={`${field} h-10 w-full`} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-zinc-700">
            Percent
            <input name="percent" type="number" min={0} max={100} defaultValue={10} className={`${field} h-10 w-full`} />
          </label>
          <button className={`${btn.base} ${btn.primary} h-10 px-4`}>Add introducer</button>
        </form>
        <IntroducerTable rows={views} subjectTemplate={template.subject} bodyTemplate={template.body} />
      </Card>
    </PageBody>
  );
}
