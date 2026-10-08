import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-lg bg-zinc-50 p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <span className="font-display text-xl tracking-[0.3em] text-zinc-950">ECRAM EXECS</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Reservations admin</span>
        </div>
        <Suspense fallback={<div className="h-64" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
