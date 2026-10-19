import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth/session";
import { LockIcon } from "../_components/icons";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: admin.login.signIn };
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  // Nobody is signed in yet, so there is no admin preference to read — the login screen uses
  // the default locale. The signed-in panel follows `admin_users.locale` from here on.
  const { admin: t } = await getDictionary(DEFAULT_LOCALE);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_at_30%_40%,#000_20%,transparent_75%)]"
        />
        <div aria-hidden="true" className="absolute -left-40 top-1/3 size-130 rounded-full bg-zinc-500/10 blur-3xl" />
        <div className="relative flex flex-col leading-none">
          <span className="font-display text-lg tracking-[0.32em] text-white">{t.nav.brand}</span>
          <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">{t.nav.subtitle}</span>
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-3xl leading-snug tracking-wide text-white">{t.login.quote}</p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {t.login.blurb}
          </p>
        </div>
        <p className="relative text-xs text-zinc-500">{t.login.internalOnly}</p>
      </div>

      {/* Form */}
      <div className="flex flex-col items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center gap-1.5 text-center lg:hidden">
            <span className="font-display text-xl tracking-[0.3em] text-zinc-950">{t.nav.brand}</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.login.brandSubtitle}</span>
          </div>
          <span className="hidden size-11 place-items-center rounded-xl border lg:grid border-zinc-200 bg-white text-zinc-700 shadow-card">
            <LockIcon size={18} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">{t.login.heading}</h1>
          <p className="mt-1.5 text-sm text-zinc-500">{t.login.intro}</p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-64" />}>
              <LoginContent searchParams={searchParams} />
            </Suspense>
          </div>
          <p className="mt-10 text-center text-xs text-zinc-400">{t.login.protected}</p>
        </div>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      copy={{
        email: admin.common.email,
        password: admin.login.password,
        signIn: admin.login.signIn,
        signingIn: admin.login.signingIn,
        emailPlaceholder: admin.login.emailPlaceholder,
        showPassword: admin.login.showPassword,
        hidePassword: admin.login.hidePassword,
      }}
    />
  );
}
