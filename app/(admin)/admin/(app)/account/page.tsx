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
import { beginTotp, confirmTotp, disableTotp, resetTotpFor } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: admin.account.title };
}

export default function AccountPage({ searchParams }: { searchParams: Promise<{ totp?: string }> }) {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <AccountScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountScreen({ searchParams }: { searchParams: Promise<{ totp?: string }> }) {
  const [{ admin: t }, admin, query] = await Promise.all([adminDictionary(), requireAdmin(), searchParams]);
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
          {query.totp === "rejected" ? <p className="m-0 text-red-700">That code did not match. Wait for the next code and try again.</p> : null}
          {query.totp === "cleared" ? <p className="m-0 text-emerald-700">Authenticator reset. That account signs in with its password.</p> : null}
          {query.totp === "missing" ? <p className="m-0 text-red-700">No account uses that email.</p> : null}
          {query.totp === "denied" ? <p className="m-0 text-red-700">Only an owner can reset an authenticator.</p> : null}
          {query.totp === "failed" ? <p className="m-0 text-red-700">The authenticator could not be reset. Try again.</p> : null}
          {signIn?.enabled ? (
            <>
              <p className="m-0">Two-factor login is on for this account.</p>
            </>
          ) : (
            <>
              <form action={beginTotp}><button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Generate authenticator secret</button></form>
              {signIn?.secret ? (
                <>
                  <p className="m-0 break-all font-mono text-[13px]">{signIn.secret}</p>
                  <p className="m-0 break-all text-[12px] text-zinc-500">{totpUri(admin.email, signIn.secret)}</p>
                  <form action={confirmTotp} className="flex flex-wrap items-center gap-2">
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} placeholder="6-digit code" className={`${field} h-10 w-40`} />
                    <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Confirm code</button>
                  </form>
                </>
              ) : null}
            </>
          )}
          {(signIn?.enabled || signIn?.secret) && admin.role === "owner" ? (
            <form action={disableTotp}>
              <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Reset authenticator</button>
            </form>
          ) : null}
          {admin.role === "owner" ? (
            <form action={resetTotpFor} className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
              <label className="text-[13px] text-zinc-700">Reset another account
                <input name="email" type="email" required placeholder="name@company.com" className={`${field} mt-1 h-10 w-64`} />
              </label>
              <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Reset their authenticator</button>
            </form>
          ) : null}
        </div>
      </Card>
    </PageBody>
  );
}
