import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/lib/corporate/account-actions";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, type AppRoute } from "@/lib/i18n/pathnames";
import { ghostClass } from "./corporate-styles";
import { CorporateShell } from "./corporate-shell";

export type PortalSection = "bookings" | "new" | "introduction";

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
    ["introduction", p.navIntro, localizedPath("/corporate-partner/account/introduction", locale)],
  ];
  return (
    <CorporateShell route={route} heading={heading} intro={intro}>
      <nav aria-label={p.navLabel} className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-ink-225 pb-4">
        <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0">
          {items.map(([key, label, href]) => (
            <li key={key}>
              <Link
                href={href}
                aria-current={key === current ? "page" : undefined}
                className={`text-[12px] font-semibold tracking-[0.2em] uppercase no-underline ${key === current ? "text-ink-950 underline underline-offset-[10px] decoration-2" : "text-ink-600 hover:text-ink-950"}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={logout}>
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
