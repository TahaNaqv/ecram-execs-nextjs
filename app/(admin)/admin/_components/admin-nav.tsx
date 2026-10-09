"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { InboxIcon, MenuIcon, NoteIcon, SteeringIcon, XIcon } from "./icons";

const LINKS = [
  { href: "/admin", label: "Requests", icon: InboxIcon, match: (p: string) => p === "/admin" || p.startsWith("/admin/requests") },
  {
    href: "/admin/drivers",
    label: "Drivers",
    icon: SteeringIcon,
    match: (p: string) => p.startsWith("/admin/drivers") && !p.startsWith("/admin/drivers/applications"),
  },
  { href: "/admin/drivers/applications", label: "Applications", icon: NoteIcon, match: (p: string) => p.startsWith("/admin/drivers/applications") },
];

function Wordmark() {
  return (
    <Link href="/admin" className="flex flex-col leading-none">
      <span className="font-display text-[15px] tracking-[0.32em] text-white">ECRAM EXECS</span>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">Reservations</span>
    </Link>
  );
}

/**
 * Sidebar on desktop, slide-in drawer on smaller screens.
 * `badges` and `account` are server-rendered slots (they read the database).
 */
export function AdminChrome({
  badges,
  account,
}: {
  badges: Partial<Record<string, React.ReactNode>>;
  account: React.ReactNode;
}) {
  const pathname = usePathname();
  // The drawer is only open on the page it was opened from, so navigating closes it
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const current = LINKS.find((l) => l.match(pathname));

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpenOn(pathname)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="-ml-1.5 grid size-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <MenuIcon size={20} />
        </button>
        <Wordmark />
        {current && <span className="ml-auto text-xs font-medium text-zinc-400">{current.label}</span>}
      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpenOn(null)}
        className={`fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-[2px] transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-zinc-950 text-zinc-300 transition-[transform,visibility] duration-200 ease-out lg:visible lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 lg:h-20">
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpenOn(null)}
            aria-label="Close menu"
            className="-mr-2 grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <XIcon size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2" aria-label="Admin sections">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">Operations</p>
          <div className="flex flex-col gap-0.5">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                    active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                  }`}
                >
                  <Icon size={18} className={active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"} />
                  {l.label}
                  <span className="ml-auto">{badges[l.href]}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3">{account}</div>
      </aside>
    </>
  );
}
