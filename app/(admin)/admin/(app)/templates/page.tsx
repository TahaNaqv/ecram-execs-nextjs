import type { Metadata } from "next";
import { Suspense } from "react";
import { can } from "@/lib/admin/access";
import { listTemplates, type TemplateKey } from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { adminDictionary, getDictionary } from "@/lib/i18n/get-dictionary";
import { Card, PageBody, PageHeader } from "../../_components/ui";
import { TemplateForm } from "./template-form";

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
  };
  return (
    <PageBody>
      <PageHeader title={t.templatesDesk.title} description={t.templatesDesk.note} />
      <div className="mt-6 flex flex-col gap-4">
        {rows.map((row) => (
          <Card key={row.key}>
            <div className="p-5">
              <TemplateForm row={row} title={names[row.key]} copy={t.templatesDesk} />
            </div>
          </Card>
        ))}
      </div>
    </PageBody>
  );
}
