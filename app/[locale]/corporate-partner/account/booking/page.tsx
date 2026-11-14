import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { renderPartnerEvent } from "@/lib/admin/events";
import { bookingInvoicesFor, bookingTimeline, getBooking, MESSAGEABLE } from "@/lib/corporate/bookings";
import { formatBytes, formatPartnerAmount, formatPickup, formatStamp } from "@/lib/corporate/format";
import { requirePartner } from "@/lib/corporate/portal";
import { customerInvoices, payable } from "@/lib/moneybird/customer";
import { browserMapKey, routeMapLinks } from "@/lib/fleet/map";
import { convoyTitle, vehicleByKey } from "@/lib/fleet/vehicles";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { serviceLabel } from "@/lib/quotes/constants";
import { stopsWithWaits } from "@/lib/quotes/stops";
import { extraName } from "@/lib/pricing/extras";
import { bookingTotalEuros, formatCents, priceNet } from "@/lib/pricing/rates";
import { savedRouteLine } from "@/lib/pricing/saved-route";
import { extrasLine } from "@/lib/pricing/extras";
import { DownloadableReceiptCard, RouteMap, type RideReceipt } from "../../../_components/booking/booking-flow";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { outlineButton, submitClass } from "../../../_components/corporate-styles";
import { MessageForm } from "../../../_components/portal-message-form";
import { QuoteResponse } from "../../../_components/portal-quote-response";
import { PortalPage } from "../../../_components/portal-shell";
import { PortalStatus } from "../../../_components/portal-status";
import { ReviewRefresh } from "../../../_components/review-refresh";
import { paymentView } from "@/lib/mollie/pay";
import { PayButton } from "../../../_components/pay-button";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">{label}</dt>
      <dd className="m-0 wrap-break-word text-[15px] text-ink-950">{children}</dd>
    </div>
  );
}

function TripCard({ id, title, children, wide }: { id: string; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-solid border-ink-225 bg-white ${wide ? "lg:col-span-2" : ""}`}>
      <h3 id={id} className="m-0 border-0 border-b border-solid border-ink-150 px-5 py-3.5 text-[11px] font-semibold leading-none text-ink-600 uppercase md:px-6">
        <span className="-mr-[0.22em] inline-block tracking-[0.22em]">{title}</span>
      </h3>
      <div className="flex flex-col gap-5 p-5 md:p-6">{children}</div>
    </section>
  );
}

function Pill({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <span
      className={
        emphasis
          ? "inline-flex w-fit max-w-full items-center rounded-full border border-solid border-ink-225 bg-ink-950 px-4 py-2 font-serif text-[22px] leading-none text-ink-50"
          : "inline-flex w-fit max-w-full items-center rounded-full border border-solid border-ink-225 bg-ink-100 px-3 py-1 text-[13px] font-semibold tracking-wide text-ink-950"
      }
    >
      {children}
    </span>
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
  const [timeline, invoices, issued, payment] = await Promise.all([
    bookingTimeline(booking.id),
    bookingInvoicesFor(booking.id),
    customerInvoices(booking.id),
    paymentView(booking.id, locale),
  ]);
  const g = d.guestBooking;

  const eventLabels = { ...p.events, statuses: p.statuses };
  const amount = (value: string | null) => (value === null ? p.events.none : formatPartnerAmount(value, locale));
  const waiting = booking.status === "quoted" && booking.quotedAmount !== null;
  const open = (MESSAGEABLE as readonly string[]).includes(booking.status);
  const bespoke = booking.service === "bespoke";
  const hourly = booking.service === "hourly";
  const intermediates = stopsWithWaits(booking.destinations, booking.destinationWaits).filter((s) => s.place.trim());
  // In travelling order: where from, each stop on the way, where to. Every place is Stop 1, Stop 2, …
  const stops = [
    { text: booking.collection, wait: 0 },
    ...intermediates.map((s) => ({ text: s.place, wait: s.wait })),
    {
      text: booking.destination ?? (booking.durationHours ? interpolate(d.booking.asDirected, { hours: booking.durationHours }) : null),
      wait: 0,
    },
  ].filter((s) => s.text);
  const cars = convoyTitle(booking) ?? vehicleByKey(booking.vehicle)?.name ?? (booking.vehicle === "advise" ? d.quoteForm.vehicleAdvise : booking.vehicle);
  const party = [
    booking.passengers == null ? "" : booking.passengers === 1 ? d.booking.passengerOne : interpolate(d.booking.passengerMany, { count: booking.passengers }),
    booking.luggage == null || booking.luggage === 0 ? "" : booking.luggage === 1 ? d.booking.largeOne : interpolate(d.booking.largeMany, { count: booking.luggage }),
    booking.handLuggage == null || booking.handLuggage === 0 ? "" : booking.handLuggage === 1 ? d.booking.smallOne : interpolate(d.booking.smallMany, { count: booking.handLuggage }),
  ].filter(Boolean).join(", ");
  const euros = bookingTotalEuros(booking);
  const receiptPrice = euros ? { total: Math.round(Number(euros) * 100), exact: booking.priceEstimate?.exact ?? true } : null;
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
  const statusLabel = p.statuses[booking.status as keyof typeof p.statuses] ?? booking.status;
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
  const loginHref = localizedPath("/corporate-partner/login", locale);
  const routeMap = bespoke ? null : routeMapLinks(booking, browserMapKey());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={localizedPath("/corporate-partner/account", locale)} className="self-start text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4">
          ← {p.backToBookings}
        </Link>
        <DownloadableReceiptCard
          copy={d.booking}
          locale={locale}
          reference={booking.reference}
          status={statusLabel}
          name={booking.name}
          receipt={savedReceipt}
          price={receiptPrice}
        />
      </div>

      {created === "1" && <p className="m-0 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-[15px] text-ink-950">{p.createdNotice}</p>}

      {/* Every booking is reviewed by hand (the client, 8 Nov 2026): the page follows the review by itself */}
      {(booking.status === "new" || booking.status === "contacted") && (
        <div role="status" className="flex items-center gap-3 border border-solid border-ink-225 bg-white px-4 py-3.5 text-ink-950">
          {booking.status === "new" && (
            <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-solid border-ink-150 border-t-ink-950 motion-reduce:animate-none" />
          )}
          <p className="m-0 min-w-0 flex-1 text-[15px] leading-snug">{booking.status === "new" ? p.reviewNew : p.reviewContacted}</p>
          <ReviewRefresh />
        </div>
      )}


      {/* Approved: paid online through Mollie (the client, 8 Nov 2026) */}
      {payment && (booking.status === "confirmed" || booking.status === "completed") && (payment.due > 0 || payment.state !== "none") && (
        <div role="status" className="flex flex-col gap-3 border border-solid border-ink-225 bg-white px-4 py-3.5 text-ink-950">
          {payment.state === "paid" && payment.due === 0 && (
            <p className="m-0 text-[15px] font-semibold">{payment.paidOn ? interpolate(g.paidOn, { date: payment.paidOn }) : g.paidThanks}</p>
          )}
          {payment.state === "progress" && <p className="m-0 text-[15px]">{g.payInProgress}</p>}
          {payment.state === "failed" && payment.due > 0 && <p className="m-0 text-[15px]">{g.payNotCompleted}</p>}
          {payment.due > 0 && payment.state !== "progress" && (
            <PayButton
              who="partner"
              reference={booking.reference}
              locale={locale}
              label={interpolate(g.payNow, { amount: payment.dueLabel })}
              pendingLabel={g.payOpening}
              className={`${submitClass} max-w-[320px]`}
            />
          )}
        </div>
      )}

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

      <section aria-labelledby="trip" className="flex flex-col gap-4">
        <h2 id="trip" className="m-0 font-serif text-[32px] leading-none font-normal text-ink-950">
          {p.sectionTrip}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <TripCard id="trip-route" title={p.sectionRoute} wide>
            <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <Fact label={d.quoteForm.labelService}>{serviceLabel(booking.service, d.services)}</Fact>
              <Fact label={d.quoteForm.labelDateTime}>
                {booking.pickupAt ? formatPickup(booking.pickupAt, locale) : p.dateToBeAgreed}
              </Fact>
              {booking.returnAt && <Fact label={d.booking.summaryReturn}>{formatPickup(booking.returnAt, locale)}</Fact>}
              {booking.flightNumber && <Fact label={d.booking.flight}>{booking.flightNumber}</Fact>}
              <Fact label={d.booking.reviewDistance}>{routeLine}</Fact>
              {bespoke ? (
                booking.itinerary && (
                  <div className="sm:col-span-2">
                    <Fact label={d.bespokeSection.labelItinerary}>
                      <span className="whitespace-pre-wrap">{booking.itinerary}</span>
                    </Fact>
                  </div>
                )
              ) : (
                <div className="sm:col-span-2">
                  <Fact label={d.booking.summaryRoute}>
                    <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {stops.map((stop, i) => (
                        <li key={i} className="min-w-0">
                          {interpolate(d.booking.stopLabel, { number: i + 1 })}: {stop.text}
                          {stop.wait > 0 && <span className="text-ink-600"> · {interpolate(p.stopWait, { minutes: stop.wait })}</span>}
                        </li>
                      ))}
                    </ol>
                  </Fact>
                </div>
              )}
              {booking.notes && (
                <div className="sm:col-span-2">
                  <Fact label={d.quoteForm.labelNotes}>
                    <span className="block max-h-28 overflow-y-auto text-left break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{booking.notes}</span>
                  </Fact>
                </div>
              )}
            </dl>
          </TripCard>

          <TripCard id="trip-vehicle" title={p.sectionVehicle}>
            <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {booking.passengers !== null && <Fact label={d.quoteForm.labelPassengers}>{booking.passengers}</Fact>}
              {booking.luggage !== null && <Fact label={d.booking.suitcases}>{booking.luggage}</Fact>}
              {booking.handLuggage != null && <Fact label={d.booking.smallBags}>{booking.handLuggage}</Fact>}
              {booking.passengerName && (
                <Fact label={d.booking.passengerName}>
                  {booking.passengerName}
                  {booking.passengerPhone && <span className="text-ink-600"> · {booking.passengerPhone}</span>}
                </Fact>
              )}
              {booking.vehicle && (
                <div className="sm:col-span-2">
                  <Fact label={d.quoteForm.labelVehicle}>
                    <Pill>{convoyTitle(booking) ?? vehicleByKey(booking.vehicle)?.name ?? (booking.vehicle === "advise" ? d.quoteForm.vehicleAdvise : booking.vehicle)}</Pill>
                  </Fact>
                </div>
              )}
              {extrasLine(d.addOns, booking.extras) && (
                <div className="sm:col-span-2">
                  <Fact label={d.booking.reviewExtras}>{extrasLine(d.addOns, booking.extras)}</Fact>
                </div>
              )}
            </dl>
          </TripCard>

          <TripCard id="trip-price" title={p.sectionPrice}>
            <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5">
              {booking.quotedAmount && (
                <Fact label={p.labelQuote}>
                  <Pill >{formatPartnerAmount(booking.quotedAmount, locale)}</Pill>
                </Fact>
              )}
              {!booking.quotedAmount && booking.priceEstimate && (
                <Fact label={d.booking.priceEstimateLabel}>
                  <span className="flex flex-col items-start gap-2">
                    <Pill emphasis>
                      {(booking.priceEstimate.exact ? "" : `${d.booking.priceFromWord} `) + formatCents(booking.priceEstimate.total, locale)}
                    </Pill>
                    <span className="text-[13px] leading-snug text-ink-600">
                      {interpolate(d.booking.priceEstimateValue, {
                        net: (booking.priceEstimate.exact ? "" : `${d.booking.priceFromWord} `) + formatCents(priceNet(booking.priceEstimate), locale),
                        total: formatCents(booking.priceEstimate.total, locale),
                      })}
                    </span>
                  </span>
                </Fact>
              )}
              <Fact label={p.labelReceived}>{formatStamp(booking.createdAt, locale)}</Fact>
            </dl>
          </TripCard>
        </div>

        {/* The route on Google's map: only here, once the booking is in, never while it is being made */}
        {routeMap && <RouteMap map={routeMap} copy={d.booking} />}
        {!bespoke && (
          <Link href={`${localizedPath("/corporate-partner/account/new-booking", locale)}?repeat=${booking.reference}`} className={`${outlineButton} self-start`}>
            {p.repeatCta}
          </Link>
        )}
      </section>

      {(invoices.length > 0 || issued.length > 0) && (
        <section aria-labelledby="invoices" className="flex flex-col gap-4">
          <h3 id="invoices" className="m-0 border-b border-ink-225 pb-2 text-[11px] font-semibold tracking-[0.24em] text-ink-950 uppercase">
            {p.sectionInvoices}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-px border border-ink-225 bg-ink-225 p-0">
            {issued.map((inv) => {
              const href = payable(inv) ? (inv.paymentUrl ?? inv.url) : inv.url;
              return (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 text-[14px]">
                <span className="min-w-0 wrap-break-word">
                  {interpolate(inv.kind === "credit" ? p.invoiceCredit : p.invoiceNumber, { number: inv.number })}
                  {inv.totalCents != null && <span className="text-ink-600"> · {formatPartnerAmount((inv.totalCents / 100).toFixed(2), locale)}</span>}
                  <span className="text-ink-600"> · {(p.invoiceStates as Record<string, string>)[inv.state] ?? inv.state}</span>
                </span>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4"
                  >
                    {payable(inv) ? p.invoicePay : p.invoiceView}
                  </a>
                )}
              </li>
              );
            })}
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

      <section aria-labelledby="activity" className="flex flex-col gap-4">
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
