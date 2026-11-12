import Link from "next/link";
import { Suspense } from "react";
import { bookingTabCounts, isPortalTab, listBookings, PORTAL_PAGE_SIZE, PORTAL_TABS, type PortalTab } from "@/lib/corporate/bookings";
import { formatPartnerAmount, formatPickup } from "@/lib/corporate/format";
import { requirePartner } from "@/lib/corporate/portal";
import { billingDetails } from "@/lib/corporate/billing";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { serviceLabel } from "@/lib/quotes/constants";
import { corporateMetadata, PanelSkeleton } from "../../_components/corporate-shell";
import { linkButton } from "../../_components/corporate-styles";
import { PortalPage } from "../../_components/portal-shell";
import { PortalStatus } from "../../_components/portal-status";

/**
 * The partner's bookings: open, past, and cancelled. The sign-in is checked against the database here; without one
 * the visitor is sent to log in. The list only ever holds this partner's own bookings.
 */
async function Bookings({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/account">, "searchParams">) {
  const { tab: rawTab, page: rawPage } = await searchParams;
  const { locale, contact } = await requirePartner("/corporate-partner/account");
  const [d, billing] = await Promise.all([getDict(), billingDetails(contact.id)]);
  const p = d.portal;

  const counts = await bookingTabCounts();
  const tab: PortalTab = isPortalTab(rawTab) ? rawTab : "open";
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const { rows, total } = await listBookings(tab, page);
  const pages = Math.max(1, Math.ceil(total / PORTAL_PAGE_SIZE));

  const base = localizedPath("/corporate-partner/account", locale);
  const detail = (reference: string) => `${localizedPath("/corporate-partner/account/booking", locale)}?ref=${reference}`;
  const tabLabel: Record<PortalTab, string> = { open: p.tabOpen, past: p.tabPast, cancelled: p.tabCancelled };
  const empty: Record<PortalTab, string> = { open: p.emptyOpen, past: p.emptyPast, cancelled: p.emptyCancelled };

  return (
    <div className="flex flex-col gap-6">
      {billing && !billing.complete && (
        <p className="m-0 border border-solid border-ink-225 bg-white p-4 text-[14px] text-ink-800">
          {p.billing.missingNotice}{" "}
          <Link href={localizedPath("/corporate-partner/account/billing", locale)} className="text-ink-950 underline underline-offset-4">
            {p.billing.missingLink}
          </Link>
        </p>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 border-b border-white/20 p-0" aria-label={p.headingBookings}>
        {PORTAL_TABS.map((key) => {
          const current = key === tab;
          return (
            <li key={key}>
              <Link
                href={`${base}?tab=${key}`}
                aria-current={current ? "page" : undefined}
                className={`inline-block border-b-2 px-0.5 pb-3 text-[12px] tracking-[0.16em] uppercase no-underline sm:tracking-[0.18em] ${current ? "ee-mark -mb-px border-ink-950 font-bold text-ink-950" : "ee-mark-hover border-transparent font-semibold text-zinc-400 hover:border-ink-950 hover:text-ink-950"}`}
              >
                {tabLabel[key]} <span className={current ? "text-[#ffffff]/70" : "text-zinc-500"}>({counts[key]})</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="m-0 text-[15px] text-ink-700">{empty[tab]}</p>
          <Link href={localizedPath("/corporate-partner/account/new-booking", locale)} className={linkButton}>
            {p.emptyAction}
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-px border border-ink-225 bg-ink-225 p-0">
          {rows.map((r) => {
            const more = r.destinations?.length ?? 0; // stops on the way
            const trip =
              r.collection && r.destination
                ? `${r.collection} → ${r.destination}${more > 0 ? ` (+${more})` : ""}`
                : serviceLabel(r.service, d.services);
            return (
              <li key={r.reference} className="bg-white">
                <Link href={detail(r.reference)} className="grid gap-x-6 gap-y-2 px-5 py-4 text-ink-950 no-underline hover:bg-ink-50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-3">
                      <strong className="text-[14px] font-semibold tracking-[0.08em]">{r.reference}</strong>
                      <PortalStatus status={r.status} labels={p.statuses} />
                    </span>
                    <span className="wrap-break-word text-[15px]">{trip}</span>
                    <span className="text-[13px] text-ink-600">{r.pickupAt ? formatPickup(r.pickupAt, locale) : p.dateToBeAgreed}</span>
                  </span>
                  <span className="flex items-center gap-4 md:justify-end">
                    {r.quotedAmount && <span className="text-[15px] font-semibold tabular-nums">{formatPartnerAmount(r.quotedAmount, locale)}</span>}
                    <span className="text-[12px] tracking-[0.2em] text-ink-600 uppercase underline underline-offset-4">{p.viewBooking}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-4 text-[13px] text-ink-700" aria-label={p.headingBookings}>
          {page > 1 ? (
            <Link href={`${base}?tab=${tab}&page=${page - 1}`} className="text-ink-950 underline underline-offset-4">
              {p.previous}
            </Link>
          ) : (
            <span />
          )}
          <span>{interpolate(p.pageOf, { page, pages })}</span>
          {page < pages ? (
            <Link href={`${base}?tab=${tab}&page=${page + 1}`} className="text-ink-950 underline underline-offset-4">
              {p.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      
    </div>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/[locale]/corporate-partner/account">) {
  const p = (await getDict()).portal;
  return (
    <PortalPage route="/corporate-partner/account" current="bookings" heading={p.headingBookings}>
      <Suspense fallback={<PanelSkeleton />}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </PortalPage>
  );
}

export async function generateMetadata() {
  const p = (await getDict()).portal;
  return corporateMetadata("/corporate-partner/account", p.metaTitleBookings, (await getDict()).corporatePartner.metaDescription, false);
}
