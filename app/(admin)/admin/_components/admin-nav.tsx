"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BriefcaseIcon,
  CarIcon,
  ChatIcon,
  ChevronDownIcon,
  ClockIcon,
  EuroIcon,
  InboxIcon,
  LayoutGridIcon,
  MenuIcon,
  NoteIcon,
  SteeringIcon,
  XIcon,
} from "./icons";

/** Labels arrive from the server as `copy`, since a Client Component cannot read the dictionary. */
export type AdminNavCopy = {
  brand: string;
  subtitle: string;
  sectionsLabel: string;
  operations: string;
  fleetPartners: string;
  finance: string;
  dashboard: string;
  enquiries: string;
  requests: string;
  chats?: string;
  drivers: string;
  applications: string;
  corporate: string;
  vehicles: string;
  fleetOverview?: string;
  vehicleCosts?: string;
  financials?: string;
  openMenu: string;
  closeMenu: string;
};

type NavChild = {
  href: string;
  key: keyof AdminNavCopy;
  defaultLabel: string;
  match: (p: string, from?: string | null) => boolean;
};

type NavItem = {
  href: string;
  key: keyof AdminNavCopy;
  defaultLabel: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
  match: (p: string, from?: string | null) => boolean;
  children?: NavChild[];
};

type NavSection = {
  titleKey: "operations" | "fleetPartners" | "finance";
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    titleKey: "operations",
    items: [
      { href: "/admin", key: "dashboard", defaultLabel: "Dashboard", icon: LayoutGridIcon, match: (p: string) => p === "/admin" },
      {
        href: "/admin/enquiries",
        key: "enquiries",
        defaultLabel: "Enquiries",
        icon: ClockIcon,
        match: (p: string, from?: string | null) => p.startsWith("/admin/enquiries") || (p.startsWith("/admin/requests/") && from === "enquiries"),
      },
      {
        href: "/admin/requests",
        key: "requests",
        defaultLabel: "Bookings",
        icon: InboxIcon,
        match: (p: string, from?: string | null) => p.startsWith("/admin/requests") && !(p.startsWith("/admin/requests/") && from === "enquiries"),
      },
      { href: "/admin/chats", key: "chats", defaultLabel: "Live Chats", icon: ChatIcon, match: (p: string) => p.startsWith("/admin/chats") },
    ],
  },
  {
    titleKey: "fleetPartners",
    items: [
      { href: "/admin/corporate", key: "corporate", defaultLabel: "Corporate Partners", icon: BriefcaseIcon, match: (p: string) => p.startsWith("/admin/corporate") },
      {
        href: "/admin/vehicles",
        key: "vehicles",
        defaultLabel: "Fleet & Compliance",
        icon: CarIcon,
        match: (p: string) => p.startsWith("/admin/vehicles"),
        children: [
          { href: "/admin/vehicles", key: "fleetOverview", defaultLabel: "Fleet overview", match: (p: string) => p === "/admin/vehicles" },
          { href: "/admin/vehicles/financials", key: "vehicleCosts", defaultLabel: "Vehicle costs", match: (p: string) => p.startsWith("/admin/vehicles/financials") },
        ],
      },
      {
        href: "/admin/drivers",
        key: "drivers",
        defaultLabel: "Drivers",
        icon: SteeringIcon,
        match: (p: string) => p.startsWith("/admin/drivers") && !p.startsWith("/admin/drivers/applications"),
      },
      { href: "/admin/drivers/applications", key: "applications", defaultLabel: "Applications", icon: NoteIcon, match: (p: string) => p.startsWith("/admin/drivers/applications") },
    ],
  },
  {
    titleKey: "finance",
    items: [
      { href: "/admin/financials", key: "financials", defaultLabel: "Billing & Financials", icon: EuroIcon, match: (p: string) => p.startsWith("/admin/financials") },
    ],
  },
];

const ALL_LINKS = SECTIONS.flatMap((s) => s.items);

function Wordmark({ copy }: { copy: AdminNavCopy }) {
  return (
    <Link href="/admin" className="flex flex-col leading-none">
      <span className="font-display text-[15px] tracking-[0.32em] text-white">{copy.brand}</span>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">{copy.subtitle}</span>
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
  copy,
}: {
  badges: Partial<Record<string, React.ReactNode>>;
  account: React.ReactNode;
  copy: AdminNavCopy;
}) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const search = useSearchParams();
  const from = search.get("from");
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

  const current = ALL_LINKS.find((l) => l.match(pathname, from));

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpenOn(pathname)}
          aria-label={copy.openMenu}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="-ml-1.5 grid size-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <MenuIcon size={20} />
        </button>
        <Wordmark copy={copy} />
        {current && (
          <span className="ml-auto text-xs font-medium text-zinc-400">
            {copy[current.key] || current.defaultLabel}
          </span>
        )}
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
          <Wordmark copy={copy} />
          <button
            type="button"
            onClick={() => setOpenOn(null)}
            aria-label={copy.closeMenu}
            className="-mr-2 grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <XIcon size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none" aria-label={copy.sectionsLabel}>
          {SECTIONS.map((section, sIdx) => (
            <div key={section.titleKey} className={sIdx > 0 ? "mt-4 pt-3 border-t border-zinc-900" : ""}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {copy[section.titleKey]}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((l) => {
                  const active = l.match(pathname, from);
                  const Icon = l.icon;
                  const label = copy[l.key] || l.defaultLabel;
                  const expanded = l.children ? (opened[l.href] ?? active) : false;
                  return (
                    <div key={l.href}>
                      <div
                        className={`group flex h-9 items-center gap-1 rounded-lg pr-1 text-[13px] font-medium transition-colors ${
                          active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                        }`}
                      >
                        <Link
                          href={l.href}
                          aria-current={active && !l.children ? "page" : undefined}
                          className="flex h-9 min-w-0 flex-1 items-center gap-3 rounded-lg px-3"
                        >
                          <Icon size={17} className={active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"} />
                          <span className="truncate">{label}</span>
                          <span className="ml-auto">{badges[l.href]}</span>
                        </Link>
                        {l.children && (
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={label}
                            onClick={() => setOpened((current) => ({ ...current, [l.href]: !expanded }))}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
                          >
                            <ChevronDownIcon size={14} className={expanded ? "rotate-180" : ""} />
                          </button>
                        )}
                      </div>
                      {l.children && expanded && (
                        <div className="mt-0.5 flex flex-col gap-0.5 pl-8">
                          {l.children.map((child) => {
                            const childActive = child.match(pathname, from);
                            const childLabel = copy[child.key] || child.defaultLabel;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                aria-current={childActive ? "page" : undefined}
                                className={`flex h-8 items-center rounded-lg px-3 text-[13px] ${
                                  childActive ? "bg-white/[0.08] font-medium text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                                }`}
                              >
                                <span className="truncate">{childLabel}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-3">{account}</div>
      </aside>
    </>
  );
}