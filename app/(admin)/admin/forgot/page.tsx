import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ensureInitialStaff } from "@/lib/admin/staff";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: admin.account.forgot };
}

export default function ForgotPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <ForgotScreen />
    </Suspense>
  );
}

async function ForgotScreen() {
  await ensureInitialStaff().catch(() => null);
  const { admin: t } = await getDictionary(DEFAULT_LOCALE);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">{t.account.forgot}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t.account.forgotNote}</p>
      <div className="mt-8">
        <ForgotForm copy={t.account} />
      </div>
      <Link href="/admin/login" className="mt-6 text-sm text-zinc-600 underline-offset-2 hover:underline">{t.login.signIn}</Link>
    </main>
  );
}
