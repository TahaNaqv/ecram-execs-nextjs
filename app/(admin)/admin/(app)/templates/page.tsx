import type { Metadata } from "next";
import { Suspense } from "react";
import { can } from "@/lib/admin/access";
import { listTemplates, type TemplateKey } from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { adminDictionary, getDictionary } from "@/lib/i18n/get-dictionary";
import { Card, PageBody, PageHeader } from "../../_components/ui";
import { TemplateList } from "./template-list";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: admin.templatesDesk.title };
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <TemplatesScreen />
    </Suspense>
  );
}

async function TemplatesScreen() {
  const [admin, { admin: t }] = await Promise.all([requireAdmin(), adminDictionary()]);
  if (!can(admin.role, admin.permissions, "templates")) {
    return (
      <PageBody>
        <PageHeader title={t.templatesDesk.title} description={t.staffDesk.denied} />
      </PageBody>
    );
  }
  const rows = await listTemplates();
  const names: Record<TemplateKey, string> = {
    booking_received: t.templatesDesk.booking_received,
    booking_confirmed: t.templatesDesk.booking_confirmed,
    payment_notice: t.templatesDesk.payment_notice,
    booking_alternative: t.templatesDesk.booking_alternative,
    booking_cancelled: t.templatesDesk.booking_cancelled,
    introducer_commission: t.templatesDesk.introducer_commission,
  };
  return (
    <PageBody>
      <PageHeader title={t.templatesDesk.title} description={t.templatesDesk.note} />
      <Card className="mt-6 overflow-hidden">
        <TemplateList rows={rows.map((row) => ({ key: row.key, subject: row.subject, body: row.body, title: names[row.key] }))} copy={t.templatesDesk} />
      </Card>
    </PageBody>
  );
}
