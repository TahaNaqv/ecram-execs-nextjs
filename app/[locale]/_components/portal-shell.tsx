import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/lib/corporate/account-actions";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, type AppRoute } from "@/lib/i18n/pathnames";
import { ghostClass } from "./corporate-styles";
import { CorporateShell } from "./corporate-shell";

export type PortalSection = "bookings" | "new" | "billing";

/**
 * The frame of every page behind the partner's sign-in: the Corporate Partner shell plus the portal's own navigation.
 * Static, like the shell. The sign-in itself is checked by the page's own gate (requirePartner), behind <Suspense>.
 */
export async function PortalPage({
  route,
  current,
  heading,
  intro,
  children,
}: {
  route: AppRoute;
  current: PortalSection;
  heading: string;
  intro?: string;
  children: ReactNode;
}) {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const p = d.portal;
  const items: [PortalSection, string, string][] = [
    ["bookings", p.navBookings, localizedPath("/corporate-partner/account", locale)],
    ["new", p.navNew, localizedPath("/corporate-partner/account/new-booking", locale)],
    ["billing", p.navBilling, localizedPath("/corporate-partner/account/billing", locale)],
  ];
  return (
    <CorporateShell route={route} heading={heading} intro={intro}>
      <nav aria-label={p.navLabel} className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-white/20">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
          {items.map(([key, label, href]) => (
            <li key={key}>
              <Link
                href={href}
                aria-current={key === current ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-0.5 pb-3 text-[12px] tracking-[0.16em] uppercase no-underline sm:tracking-[0.18em] ${key === current ? "ee-mark -mb-px border-ink-950 font-bold text-ink-950" : "ee-mark-hover border-transparent font-semibold text-zinc-400 hover:border-ink-950 hover:text-ink-950"}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={logout} className="pb-3">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={ghostClass}>
            {d.corporatePartner.signOut}
          </button>
        </form>
      </nav>
      {children}
    </CorporateShell>
  );
}
