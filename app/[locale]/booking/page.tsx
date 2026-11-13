import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPickup, formatStamp } from "@/lib/corporate/format";
import { browserMapKey, routeMapLinks } from "@/lib/fleet/map";
import { convoyTitle, vehicleByKey } from "@/lib/fleet/vehicles";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { extraName } from "@/lib/pricing/extras";
import { bookingTotalEuros, formatCents } from "@/lib/pricing/rates";
import { savedRouteLine } from "@/lib/pricing/saved-route";
import { getGuestBooking, guestMessages } from "@/lib/quotes/guest";
import { customerInvoices, payable } from "@/lib/moneybird/customer";
import { moneybirdConfigured } from "@/lib/moneybird/config";
import { GUEST_MESSAGEABLE } from "@/lib/quotes/constants";
import { stopsWithWaits } from "@/lib/quotes/stops";
import type { RideReceipt } from "../_components/booking/booking-flow";
import { GuestBookingView } from "../_components/booking/guest-booking";
import { LanguageSwitcher } from "../_components/language-switcher";
import { SiteFooter } from "../_components/sections";

// A private page: never indexed, and the key in its address is not passed on to other sites
export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict();
  return { title: d.guestBooking.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** The booking the link opens, or the same plain answer for anything else (a wrong key reveals nothing). */
async function Booking({ searchParams }: Pick<PageProps<"/[locale]/booking">, "searchParams">) {
  const { ref, k } = await searchParams;
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const t = d.guestBooking;
  const booking = await getGuestBooking(ref, k);
  if (!booking) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 py-8">
        <p className="m-0 text-[16px] text-ink-950">{t.notFound}</p>
        <a href={localizedPath("/", locale)} className="self-start text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4">
          {d.booking.doneAgain}
        </a>
      </div>
    );
  }
  const [messages, invoices] = await Promise.all([guestMessages(booking.id), customerInvoices(booking.id)]);
  const latest = invoices.find((inv) => inv.kind === "invoice") ?? null;
  const invoice = latest
    ? { number: latest.number, href: payable(latest) ? (latest.paymentUrl ?? latest.url) : latest.url, pay: payable(latest), emailed: latest.delivery !== "Manual" }
    : null;

  const intermediates = stopsWithWaits(booking.destinations, booking.destinationWaits).filter((s) => s.place.trim());
  const routePlaces = [
    booking.collection,
    ...intermediates.map((s) => (s.wait ? `${s.place} (${interpolate(d.booking.waitMinutes, { minutes: s.wait })})` : s.place)),
    booking.destination ?? (booking.durationHours ? interpolate(d.booking.asDirected, { hours: booking.durationHours }) : null),
  ].filter((place): place is string => Boolean(place?.trim()));
  const route = routePlaces.map((place, index) => `${interpolate(d.booking.stopLabel, { number: index + 1 })}: ${place}`);
  const cars = convoyTitle(booking) ?? vehicleByKey(booking.vehicle)?.name ?? (booking.vehicle === "advise" ? d.quoteForm.vehicleAdvise : booking.vehicle);
  // The amount the booking manager set wins over the rate card's, as in the emails (bookingTotalEuros)
  const total = bookingTotalEuros(booking);
  const price = booking.quotedAmount && total
    ? formatCents(Math.round(Number(total) * 100), locale)
    : booking.priceEstimate
      ? `${booking.priceEstimate.exact ? "" : `${d.booking.priceFromWord} `}${formatCents(booking.priceEstimate.total, locale)}`
      : null;
  const hourly = booking.service === "hourly";
  const party = [
    booking.passengers == null ? "" : booking.passengers === 1 ? d.booking.passengerOne : interpolate(d.booking.passengerMany, { count: booking.passengers }),
    booking.luggage == null || booking.luggage === 0 ? "" : booking.luggage === 1 ? d.booking.largeOne : interpolate(d.booking.largeMany, { count: booking.luggage }),
    booking.handLuggage == null || booking.handLuggage === 0 ? "" : booking.handLuggage === 1 ? d.booking.smallOne : interpolate(d.booking.smallMany, { count: booking.handLuggage }),
  ].filter(Boolean).join(", ");
  const savedReceipt: RideReceipt = {
    passengerName: booking.name,
    passengerEmail: booking.email,
    passengerPhone: booking.phone,
    leadPassenger: booking.passengerName
      ? [booking.passengerName, booking.passengerPhone].filter(Boolean).join(" · ")
      : d.booking.reviewSameAsBooker,
    pickup: booking.collection ?? "",
    dropoff: booking.destination ?? (hourly && booking.durationHours ? interpolate(d.booking.asDirected, { hours: booking.durationHours }) : ""),
    when: booking.pickupAt ? formatPickup(booking.pickupAt, locale) : "",
    hourly,
    stops: intermediates.map((s) => s.place),
    price: booking.priceEstimate,
    extraNames: (booking.extras ?? []).map((pick) => extraName(d.addOns, pick)),
    vehicle: cars ?? "",
    passengers: party,
  };
  const routeLine = await savedRouteLine(
    booking,
    {
      reviewDistanceValue: d.booking.reviewDistanceValue,
      reviewHoursMinutes: d.booking.reviewHoursMinutes,
      reviewMinutes: d.booking.reviewMinutes,
      unavailable: d.booking.reviewDistanceUnavailable,
      hourly: d.booking.asDirected,
    },
    locale,
  );
  const facts = [
    { label: t.labelReference, value: booking.reference },
    { label: t.labelWhen, value: [booking.pickupAt && formatPickup(booking.pickupAt, locale), booking.returnAt && `${d.booking.summaryReturn}: ${formatPickup(booking.returnAt, locale)}`].filter(Boolean).join(" · ") },
    { label: t.labelRoute, value: route.join("\n") },
    { label: d.booking.reviewDistance, value: routeLine },
    { label: t.labelCars, value: cars ?? "" },
    { label: t.labelPrice, value: price ?? "" },
  ].filter((f) => f.value);

  return (
    <GuestBookingView
      reference={booking.reference}
      linkKey={String(k)}
      locale={locale}
      status={booking.status}
      name={booking.name.split(" ")[0]}
      facts={facts}
      map={routeMapLinks(booking, browserMapKey())}
      price={total ? { total: Math.round(Number(total) * 100), exact: booking.priceEstimate?.exact ?? true } : null}
      messages={messages.map((m) => ({ id: m.id, by: m.by, body: m.body, at: formatStamp(m.at, locale) }))}
      lastMessageAt={messages.at(-1)?.at.toISOString() ?? null}
      open={(GUEST_MESSAGEABLE as readonly string[]).includes(booking.status)}
      copy={t}
      bookingCopy={d.booking}
      savedReceipt={savedReceipt}
      invoice={invoice}
      awaitingInvoice={booking.status === "confirmed" && !invoice && moneybirdConfigured()}
    />
  );
}

/**
 * A visitor's own booking after it is sent (the client, 8 Nov 2026): it is reviewed by hand, and this page follows the
 * review, holds the conversation with the booking manager and, once approved, the payment. Opened from the private link.
 */
export default async function BookingPage({ searchParams }: PageProps<"/[locale]/booking">) {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        {d.common.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-8 md:py-[18px] 2xl:max-w-[1440px]">
          <a href={localizedPath("/", locale)} className="chrome inline-flex items-center gap-2 font-display text-[15px] tracking-[0.2em] whitespace-nowrap no-underline md:gap-3 md:text-[22px] md:tracking-[0.32em]">
            <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span>ECRAM EXECS</span>
          </a>
          <LanguageSwitcher route="/booking" />
        </div>
      </header>
      <main id="main" className="light-surface bg-ink-50 text-ink-950">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 2xl:max-w-[1440px]">
          <Suspense fallback={<div className="min-h-[60svh]" aria-busy="true" />}>
            <Booking searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
