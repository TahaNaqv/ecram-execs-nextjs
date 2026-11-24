import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.account.resetTitle };
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { admin: t } = await adminDictionary();
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
