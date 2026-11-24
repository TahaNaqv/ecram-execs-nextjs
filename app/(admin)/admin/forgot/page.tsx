import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";
import { ensureInitialStaff } from "@/lib/admin/staff";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.account.forgot };
}

export default async function ForgotPage() {
  await ensureInitialStaff();
  const { admin: t } = await adminDictionary();
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
