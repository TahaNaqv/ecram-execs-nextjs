import type { Metadata } from "next";
import { Suspense } from "react";
import { mayCreateAccounts } from "@/lib/admin/access";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { TeamManagement } from "../../_components/team-management";
import { Card, CardHeader, PageBody, PageHeader } from "../../_components/ui";
import { AccountForm } from "./account-form";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.account.title };
}

export default function AccountPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <AccountScreen />
    </Suspense>
  );
}

async function AccountScreen() {
  const [{ admin: t }, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  const manage = mayCreateAccounts(admin.role, admin.permissions);
  return (
    <PageBody>
      <PageHeader title={t.account.title} description={t.account.note} />
      <Card className="mt-6 max-w-xl">
        <CardHeader title={admin.name} description={admin.email} />
        <div className="p-5">
          <AccountForm name={admin.name} email={admin.email} copy={t.account} />
        </div>
      </Card>
      {manage ? (
        <div className="mt-6">
          <TeamManagement />
        </div>
      ) : null}
    </PageBody>
  );
}
