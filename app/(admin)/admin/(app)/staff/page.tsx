import type { Metadata } from "next";
import { Suspense } from "react";
import { mayCreateAccounts } from "@/lib/admin/access";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { TeamManagement } from "../../_components/team-management";
import { PageBody, PageHeader } from "../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.staffDesk.title };
}

export default function StaffPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <StaffScreen />
    </Suspense>
  );
}

async function StaffScreen() {
  const [admin, { admin: t }] = await Promise.all([requireAdmin(), adminDictionary()]);
  if (!mayCreateAccounts(admin.role, admin.permissions)) {
    return (
      <PageBody>
        <PageHeader title={t.staffDesk.title} description={t.staffDesk.denied} />
      </PageBody>
    );
  }
  return (
    <PageBody>
      <PageHeader title={t.staffDesk.title} description={t.staffDesk.note} />
      <div className="mt-6">
        <TeamManagement />
      </div>
    </PageBody>
  );
}
