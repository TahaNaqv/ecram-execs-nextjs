import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { logout } from "../actions";

export async function AdminHeader() {
  const admin = await requireAdmin();
  return (
    <header className="border-b border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/admin" className="flex flex-col leading-tight">
          <span className="font-display text-base tracking-[0.3em]">ECRAM EXECS</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Reservations</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
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
  return <div className="h-[66px] border-b border-zinc-200 bg-zinc-950" />;
}
