import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { logout } from "../actions";
import { AdminNav } from "./admin-nav";

export async function AdminHeader() {
  const admin = await requireAdmin();
  return (
    <header className="border-b border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:flex-nowrap sm:px-6">
        <Link href="/admin" className="flex shrink-0 flex-col leading-tight">
          <span className="font-display text-base tracking-[0.3em]">ECRAM EXECS</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Reservations</span>
        </Link>
        {/* Own row under the logo on phones, inline beside it from sm up */}
        <div className="order-last -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto">
          <AdminNav />
        </div>
        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="hidden text-zinc-400 sm:inline">{admin.name}</span>
          <form action={logout}>
            <button className="rounded border border-zinc-700 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-400 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AdminHeaderFallback() {
  return <div className="h-[109px] border-b border-zinc-200 bg-zinc-950 sm:h-[66px]" />;
}
