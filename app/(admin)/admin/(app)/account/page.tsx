import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { totpUri } from "@/lib/auth/totp";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { adminDictionary, getDictionary } from "@/lib/i18n/get-dictionary";
import { btn, Card, CardHeader, PageBody, PageHeader, field } from "../../_components/ui";
import { AccountForm } from "./account-form";
import { beginTotp, confirmTotp } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
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
  const [signIn] = await db.select({ secret: schema.adminUsers.totpSecret, enabled: schema.adminUsers.totpEnabled }).from(schema.adminUsers).where(eq(schema.adminUsers.id, admin.id)).limit(1);
  return (
    <PageBody>
      <PageHeader title={t.account.title} />
      <Card className="mt-6 max-w-xl">
        <CardHeader title={admin.name} description={admin.email} />
        <div className="p-5">
          <AccountForm name={admin.name} email={admin.email} copy={t.account} />
        </div>
      </Card>
      <Card className="mt-6 max-w-xl">
        <CardHeader title="Two-factor login" />
        <div className="flex flex-col gap-3 p-5 text-sm text-zinc-700">
          {signIn?.enabled ? <p className="m-0">Two-factor login is on for this account.</p> : (
            <>
              <form action={beginTotp}><button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Generate authenticator secret</button></form>
              {signIn?.secret ? (
                <>
                  <p className="m-0 break-all font-mono text-[13px]">{signIn.secret}</p>
                  <p className="m-0 break-all text-[12px] text-zinc-500">{totpUri(admin.email, signIn.secret)}</p>
                  <form action={confirmTotp} className="flex flex-wrap items-center gap-2">
                    <input name="code" inputMode="numeric" required pattern="\d{6}" placeholder="6-digit code" className={`${field} h-10 w-40`} />
                    <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Confirm code</button>
                  </form>
                </>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </PageBody>
  );
}
