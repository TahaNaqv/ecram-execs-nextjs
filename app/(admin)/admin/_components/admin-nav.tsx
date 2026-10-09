"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Requests", match: (p: string) => p === "/admin" || p.startsWith("/admin/requests") },
  { href: "/admin/drivers", label: "Drivers", match: (p: string) => p.startsWith("/admin/drivers") },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Admin sections">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-1.5 text-xs uppercase tracking-widest ${active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
