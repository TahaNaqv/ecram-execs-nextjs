import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { readPendingTotp } from "@/lib/auth/totp-pending";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { adminDictionary, getDictionary } from "@/lib/i18n/get-dictionary";
import { btn, Card, CardHeader, PageBody, PageHeader, field } from "../../_components/ui";
import { ActionForm } from "../../_components/action-feedback";
import { AccountForm } from "./account-form";
import { AuthenticatorSetup } from "./authenticator-setup";
import { beginTotp, disableTotp, resetTotpFor } from "./actions";

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
  const [{ admin: t }, admin, query, pendingSecret] = await Promise.all([adminDictionary(), requireAdmin(), searchParams, readPendingTotp()]);
  const [signIn] = await db.select({ secret: schema.adminUsers.totpSecret, enabled: schema.adminUsers.totpEnabled }).from(schema.adminUsers).where(eq(schema.adminUsers.id, admin.id)).limit(1);
  const notice =
    query.totp === "enabled"
      ? { ok: true, text: "Authenticator 2FA enabled!" }
      : query.totp === "cleared"
        ? { ok: true, text: "Authenticator reset. That account signs in with its password." }
        : query.totp === "rejected"
          ? { ok: false, text: "That code did not match. Wait for the next code and try again." }
          : query.totp === "missing"
            ? { ok: false, text: "No account uses that email." }
            : query.totp === "denied"
              ? { ok: false, text: "Only an owner can reset an authenticator." }
              : query.totp === "failed"
                ? { ok: false, text: "The authenticator could not be reset. Try again." }
                : null;
  const pending = !signIn?.enabled ? pendingSecret || signIn?.secret || null : null;
  if (pending && pending !== signIn?.secret) {
    await db.update(schema.adminUsers).set({ totpSecret: pending, totpEnabled: false }).where(eq(schema.adminUsers.id, admin.id));
  }
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
          {notice ? (
            <p role={notice.ok ? "status" : "alert"} className={`fixed right-4 bottom-4 z-[80] m-0 max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg ${notice.ok ? "bg-emerald-900" : "bg-red-800"}`}>
              {notice.text}
            </p>
          ) : null}
          {signIn?.enabled ? (
            <p className="m-0">Two-factor login is on. The next sign-in asks for the code from your authenticator app.</p>
          ) : pending ? (
            <AuthenticatorSetup email={admin.email} secret={pending} />
          ) : (
            <>
              <p className="m-0 text-zinc-600">Sign-in will ask for a 6-digit code from an authenticator app, as well as the password.</p>
              <ActionForm action={beginTotp} success="Authenticator secret generated!" inline="Ready!">
                <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Set up authenticator</button>
              </ActionForm>
            </>
          )}
          {(signIn?.enabled || pending) && admin.role === "owner" ? (
            <ActionForm action={disableTotp} tone="reset">
              <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Reset authenticator</button>
            </ActionForm>
          ) : null}
          {admin.role === "owner" ? (
            <ActionForm action={resetTotpFor} tone="reset" success="Authenticator reset!" className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
              <label className="text-[13px] text-zinc-700">Reset another account
                <input name="email" type="email" required placeholder="name@company.com" className={`${field} mt-1 h-10 w-64`} />
              </label>
              <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Reset their authenticator</button>
            </ActionForm>
          ) : null}
        </div>
      </Card>
    </PageBody>
  );
}
