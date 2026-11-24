import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: admin.account.resetTitle };
}

export default function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <ResetScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetScreen({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { admin: t } = await getDictionary(DEFAULT_LOCALE);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">{t.account.resetTitle}</h1>
      <div className="mt-8">
        <ResetForm token={token ?? ""} copy={t.account} />
      </div>
      <Link href="/admin/login" className="mt-6 text-sm text-zinc-600 underline-offset-2 hover:underline">{t.login.signIn}</Link>
    </main>
  );
}
