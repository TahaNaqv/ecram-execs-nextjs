import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { renderPartnerEvent } from "@/lib/admin/events";
import { bookingInvoicesFor, bookingTimeline, getBooking, MESSAGEABLE } from "@/lib/corporate/bookings";
import { formatBytes, formatPartnerAmount, formatPickup, formatStamp } from "@/lib/corporate/format";
import { requirePartner } from "@/lib/corporate/portal";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { serviceLabel } from "@/lib/quotes/constants";
import { stopsWithWaits } from "@/lib/quotes/stops";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { outlineButton } from "../../../_components/corporate-styles";
import { MessageForm } from "../../../_components/portal-message-form";
import { QuoteResponse } from "../../../_components/portal-quote-response";
import { PortalPage } from "../../../_components/portal-shell";
import { PortalStatus } from "../../../_components/portal-status";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">{label}</dt>
      <dd className="m-0 wrap-break-word text-[15px] text-ink-950">{children}</dd>
    </div>
  );
}

/** One booking, and only if it is this partner's: anyone else's reference, or one that doesn't exist, is simply not found. */
async function Booking({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/account/booking">, "searchParams">) {
  const { ref, created } = await searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const { locale } = await requirePartner("/corporate-partner/account/booking", reference ? `?ref=${encodeURIComponent(reference)}` : "");
  if (!reference) redirect(localizedPath("/corporate-partner/account", locale));

  const booking = await getBooking(reference);
  const d = await getDict();
  const p = d.portal;
  // Someone else's reference, or none that exists: the same plain answer, so a reference reveals nothing
  if (!booking) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="m-0 text-[16px] text-ink-950">{p.bookingNotFound}</p>
        <Link href={localizedPath("/corporate-partner/account", locale)} className="text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4">
          ← {p.backToBookings}
        </Link>
      </div>
    );
  }
  const [timeline, invoices] = await Promise.all([bookingTimeline(booking.id), bookingInvoicesFor(booking.id)]);

  const eventLabels = { ...p.events, statuses: p.statuses };
  const amount = (value: string | null) => (value === null ? p.events.none : formatPartnerAmount(value, locale));
  const waiting = booking.status === "quoted" && booking.quotedAmount !== null;
  const open = (MESSAGEABLE as readonly string[]).includes(booking.status);
  const bespoke = booking.service === "bespoke";
  // In travelling order: where from, any stops on the way, where to
  const stops = [
    { text: booking.collection, wait: 0 },
    ...stopsWithWaits(booking.destinations, booking.destinationWaits).map((s) => ({ text: s.place, wait: s.wait })),
    // An hourly booking may end "as directed" instead of at a destination
    { text: booking.destination ?? (booking.durationHours ? interpolate(d.booking.asDirected, { hours: booking.durationHours }) : null), wait: 0 },
  ].filter((s) => s.text);
  const loginHref = localizedPath("/corporate-partner/login", locale);

  return (
    <div className="flex flex-col gap-10">
      <Link href={localizedPath("/corporate-partner/account", locale)} className="self-start text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4">
        ← {p.backToBookings}
      </Link>

      {created === "1" && <p className="m-0 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-[15px] text-ink-950">{p.createdNotice}</p>}


      {waiting && (
        <QuoteResponse
          reference={booking.reference}
          amount={booking.quotedAmount!}
          amountLabel={formatPartnerAmount(booking.quotedAmount!, locale)}
          locale={locale}
          loginHref={loginHref}
          copy={{ ...p, loginLink: d.corporatePartner.loginLink }}
        />
      )}

      <section aria-labelledby="trip" className="flex flex-col gap-5">
        <h3 id="trip" className="m-0 border-b border-ink-225 pb-2 text-[11px] font-semibold tracking-[0.24em] text-ink-950 uppercase">
          {p.sectionTrip}
        </h3>
        <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Fact label={d.quoteForm.labelService}>{serviceLabel(booking.service, d.services)}</Fact>
          <Fact label={d.quoteForm.labelDateTime}>
            {booking.pickupAt ? formatPickup(booking.pickupAt, locale) : p.dateToBeAgreed}
          </Fact>
          {booking.returnAt && <Fact label={d.booking.summaryReturn}>{formatPickup(booking.returnAt, locale)}</Fact>}
          {bespoke ? (
            booking.itinerary && (
              <div className="md:col-span-2">
                <Fact label={d.bespokeSection.labelItinerary}>
                  <span className="whitespace-pre-wrap">{booking.itinerary}</span>
                </Fact>
              </div>
            )
          ) : (
            <div className="md:col-span-2">
              <Fact label={`${d.quoteForm.labelCollection} → ${d.quoteForm.labelDestination}`}>
                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {stops.map((stop, i) => (
                    <li key={i}>
                      {i + 1}. {stop.text}
                      {stop.wait > 0 && <span className="text-ink-600"> · {interpolate(p.stopWait, { minutes: stop.wait })}</span>}
                    </li>
                  ))}
                </ol>
              </Fact>
            </div>
          )}
          {booking.passengers !== null && <Fact label={d.quoteForm.labelPassengers}>{booking.passengers}</Fact>}
          {booking.luggage !== null && <Fact label={d.booking.suitcases}>{booking.luggage}</Fact>}
          {booking.flightNumber && <Fact label={d.booking.flight}>{booking.flightNumber}</Fact>}
          {booking.passengerName && (
            <Fact label={d.booking.passengerName}>
              {booking.passengerName}
              {booking.passengerPhone && <span className="text-ink-600"> · {booking.passengerPhone}</span>}
            </Fact>
          )}
          {booking.vehicle && (
            <Fact label={d.quoteForm.labelVehicle}>{vehicleByKey(booking.vehicle)?.name ?? (booking.vehicle === "advise" ? d.quoteForm.vehicleAdvise : booking.vehicle)}</Fact>
          )}
          {booking.quotedAmount && <Fact label={p.labelQuote}>{formatPartnerAmount(booking.quotedAmount, locale)}</Fact>}
          <Fact label={p.labelReceived}>{formatStamp(booking.createdAt, locale)}</Fact>
          {booking.notes && (
            <div className="md:col-span-2">
              <Fact label={d.quoteForm.labelNotes}>
                <span className="whitespace-pre-wrap">{booking.notes}</span>
              </Fact>
            </div>
          )}
        </dl>
        <p className="m-0 text-[12px] text-ink-600">{p.amsterdamTime}</p>
        {!bespoke && (
          <Link href={`${localizedPath("/corporate-partner/account/new-booking", locale)}?repeat=${booking.reference}`} className={`${outlineButton} self-start`}>
            {p.repeatCta}
          </Link>
        )}
      </section>

      {invoices.length > 0 && (
        <section aria-labelledby="invoices" className="flex flex-col gap-4">
          <h3 id="invoices" className="m-0 border-b border-ink-225 pb-2 text-[11px] font-semibold tracking-[0.24em] text-ink-950 uppercase">
            {p.sectionInvoices}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-px border border-ink-225 bg-ink-225 p-0">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 text-[14px]">
                <span className="min-w-0 wrap-break-word">
                  {inv.fileName} <span className="text-ink-600">· {formatBytes(inv.size)}</span>
                </span>
                {/* A plain link: a download from a Route Handler, not a page */}
                <a href={`/api/portal/invoices/${inv.id}`} className="text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4">
                  {p.invoiceDownload}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="activity" className="flex flex-col gap-6">
        <h3 id="activity" className="m-0 border-b border-ink-225 pb-2 text-[11px] font-semibold tracking-[0.24em] text-ink-950 uppercase">
          {p.sectionActivity}
        </h3>
        {open ? (
          <MessageForm reference={booking.reference} locale={locale} loginHref={loginHref} copy={{ ...p, loginLink: d.corporatePartner.loginLink }} />
        ) : (
          <p className="m-0 text-[15px] text-ink-700">{p.messagesClosed}</p>
        )}
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {timeline.map((item) => {
            if (item.type === "event") {
              const text = renderPartnerEvent(item.event, item.params, eventLabels, (v) => amount(v));
              if (!text) return null;
              return (
                <li key={`e-${item.id}`} className="flex flex-col gap-0.5 border-l-2 border-ink-225 pl-4">
                  <span className="text-[14px] text-ink-950">{text}</span>
                  <span className="text-[12px] text-ink-600">{formatStamp(item.at, locale)}</span>
                </li>
              );
            }
            const mine = item.by === "partner";
            return (
              <li key={`m-${item.id}`} className={`flex max-w-[640px] flex-col gap-1.5 border p-4 ${mine ? "border-ink-225 bg-white" : "border-ink-950 bg-ink-50 md:ml-8"}`}>
                <span className="flex flex-wrap items-center gap-3 text-[11px] tracking-[0.18em] text-ink-600 uppercase">
                  <strong className="text-ink-950">{mine ? p.you : p.team}</strong>
                  {item.kind === "change" && <span className="bg-amber-100 px-2 py-0.5 text-amber-900">{p.tagChange}</span>}
                  {item.kind === "cancel" && <span className="bg-amber-100 px-2 py-0.5 text-amber-900">{p.tagCancel}</span>}
                  <span>{formatStamp(item.at, locale)}</span>
                </span>
                {/* Plain text: whatever was written, with its line breaks, never as markup */}
                <p className="m-0 whitespace-pre-wrap wrap-break-word text-[15px] text-ink-950">{item.body}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default async function BookingPage({ searchParams }: PageProps<"/[locale]/corporate-partner/account/booking">) {
  const p = (await getDict()).portal;
  return (
    <PortalPage route="/corporate-partner/account/booking" current="bookings" heading={p.headingBookings}>
      <Suspense fallback={<PanelSkeleton />}>
        <Booking searchParams={searchParams} />
      </Suspense>
    </PortalPage>
  );
}

// No ?ref here: the address is read at request time, which a page's metadata may not do
export async function generateMetadata() {
  const d = await getDict();
  return corporateMetadata("/corporate-partner/account/booking", d.portal.metaTitleBooking, d.corporatePartner.metaDescription, false);
}
