

export const instant = false;
import Link from "next/link";
import { FLEET, fleetPicks, normalizeVehicleKey, vehicleByKey } from "@/lib/fleet/vehicles";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, pickupInstant, pickupParts } from "@/lib/admin/format";
import { chatForRequest } from "@/lib/admin/chats";
import { getRequest } from "@/lib/admin/queries";
import { bookingServiceName, isCorporateBooking } from "@/lib/quotes/audience";
import { eventLabels, renderEvent } from "@/lib/admin/events";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { stopsWithWaits } from "@/lib/quotes/stops";
import type { QuoteRequest } from "@/lib/db/schema";
import {
  ActivityIcon,
  BriefcaseIcon,
  ChatIcon,
  ClockIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  UsersIcon,
} from "../../../_components/icons";
import { LivePipeline, LiveStatusBadge } from "../../../_components/booking-status";
import { UrgentBadge } from "../../../_components/status-badge";
import { Avatar, btn, Card, CardHeader, PageBody, Skeleton } from "../../../_components/ui";
import { deleteRequest } from "../../../actions";
import { DeleteRecord } from "../../../_components/delete-record";
import { AdminReturnLink } from "../../../_components/return-link";
import { MessagesCard } from "./messages-card";
import { ReviewCard } from "./review-card";
import { CarsEditor } from "./cars-editor";
import { MAX_PER_CAR } from "@/app/[locale]/_components/booking/trip";
import { guestUrl } from "@/lib/quotes/guest-link";
import { localizedPath } from "@/lib/i18n/pathnames";
import { browserMapKey, routeMapLinks } from "@/lib/fleet/map";
import { AutoPricingGateway } from "../../../_components/auto-pricing-gateway";
import { bookingTotalEuros, hasHighRateExtras, legSpansDays, lineDay, type Price, vatByRate } from "@/lib/pricing/rates";
import { extraName, extrasLine, type ExtraNames } from "@/lib/pricing/extras";

async function BackLink({ fromEnquiries }: { fromEnquiries: boolean }) {
  const { admin } = await adminDictionary();
  return (
    <AdminReturnLink
      fromEnquiries={fromEnquiries}
      enquiriesLabel={admin.enquiries.back}
      requestsLabel={admin.common.backToRequests}
    />
  );
}

export default async function RequestPage({ params, searchParams }: PageProps<"/admin/requests/[id]">) {
  const raw = (await searchParams).from;
  const from = Array.isArray(raw) ? raw[0] : raw;
  const fromEnquiries = from === "enquiries";
  return (
    <PageBody>
      <Suspense fallback={<span className="inline-block h-[1em] w-28 animate-pulse rounded bg-zinc-100 align-middle" />}>
        <BackLink fromEnquiries={fromEnquiries} />
      </Suspense>
      <Suspense fallback={<DetailSkeleton />}>
        <RequestDetail params={params} fromEnquiries={fromEnquiries} />
      </Suspense>
    </PageBody>
  );
}

function ContactRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-zinc-500">{label}</dt>
        <dd className="truncate text-sm text-zinc-900">{children}</dd>
      </div>
    </div>
  );
}

async function RequestDetail({ params, fromEnquiries }: Pick<PageProps<"/admin/requests/[id]">, "params"> & { fromEnquiries: boolean }) {
  try {
    return await RequestDetailBody({ params, fromEnquiries });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[admin/requests]", error);
    let message = "This booking could not be loaded. Refresh the page to try again.";
    try {
      message = (await adminDictionary()).admin.requestDetail.loadError;
    } catch (dictionaryError) {
      unstable_rethrow(dictionaryError);
    }
    return <p className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-card">{message}</p>;
  }
}

async function RequestDetailBody({ params, fromEnquiries }: Pick<PageProps<"/admin/requests/[id]">, "params"> & { fromEnquiries: boolean }) {
  const { id } = await params;
  const data = await getRequest(id);
  if (!data) notFound();
  const { request: r, events } = data as { 
    request: QuoteRequest; 
    events: Array<{ id: string; event: string; params: Record<string, string | number | null>; createdAt: Date; by: string | null }> 
  };
  const d = await adminDictionary();
  const chatId = await chatForRequest(r.id);
  const phone = typeof r.phone === "string" ? r.phone : "";
  const email = typeof r.email === "string" ? r.email : "";
  const guestName = typeof r.name === "string" && r.name.trim() ? r.name : "—";
  const history = Array.isArray(events) ? events : [];
  const price = r.priceEstimate && typeof r.priceEstimate === "object" ? r.priceEstimate : null;
  const waNumber = phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Dear ${guestName}, thank you for your request ${r.reference} with Ecram Execs.`);
  const mailto = `mailto:${email}?subject=${encodeURIComponent(`Your Ecram Execs booking ${r.reference}`)}`;
  const tel = `tel:${phone.replace(/\s/g, "")}`;
  const rd = d.admin.requestDetail;
  // The embedded map needs a browser key (restricted to this site and to the Maps Embed API); without one only the link is shown
  const links = routeMapLinks(r, browserMapKey());
  const routeMap = links ? { ...links, openLabel: rd.routeOpen, noKey: rd.routeNoKey, frameTitle: rd.routeFrameTitle } : null;

  return (
    <div className="mt-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={guestName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{guestName}</h1>
              <LiveStatusBadge requestId={r.id} status={r.status} labels={d.admin.statuses} size="md" />
              <UrgentBadge request={r} size="md" />
              <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                {bookingServiceName(r, d.services)}
                <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  {isCorporateBooking(r) ? d.admin.requests.segmentBusiness : d.admin.requests.segmentPublic}
                </span>
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{r.reference}</span>
              <span aria-hidden="true">·</span>
              <span title={formatTimestamp(r.createdAt)}>{interpolate(rd.receivedRelative, { when: formatRelative(r.createdAt) })}</span>
              <span aria-hidden="true">·</span>
              <span>{interpolate(rd.viaSource, { source: r.source })}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <a href={mailto} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <MailIcon /> {rd.emailAction}
          </a>
          <a href={tel} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <PhoneIcon /> {rd.callAction}
          </a>
          {chatId && (
            <Link href={`/admin/chats/${chatId}`} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              <ChatIcon /> {d.admin.chats.chatLink}
            </Link>
          )}
          {waNumber.length >= 8 && (
            <a
              href={`https://wa.me/${waNumber}?text=${waText}`}
              target="_blank"
              rel="noreferrer"
              className={`${btn.base} ${btn.md} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}
            >
              <ChatIcon /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="mt-6">
        <LivePipeline
          requestId={r.id}
          status={r.status}
          labels={d.admin.statuses}
          progressLabel={d.admin.common.progress}
          cancelledNote={rd.cancelledNote}
        />
      </div>

      {/* Every booking is approved by hand, or discussed with the customer first (the client, 8 Nov 2026) */}
      {(r.status === "new" || r.status === "contacted") && r.source !== "website-corporate" && (
        <div className="mt-6">
          <ReviewCard requestId={r.id} status={r.status} copy={d.admin.review} />
        </div>
      )}

      <div className="mt-6">
        <AutoPricingGateway
          request={r}
          copy={d.admin.pricing}
          statuses={d.admin.statuses}
          routeMap={routeMap}
          addOns={extrasLine(d.addOns, r.extras)}
          addOnNames={d.addOns}
          bookingLink={
            r.corporateContactId
              ? `${process.env.SITE_URL ?? ""}${localizedPath("/corporate-partner/account/booking", r.locale)}?ref=${encodeURIComponent(r.reference)}`
              : guestUrl(r, r.locale)
          }
          activity={history.map((e) => ({
            id: e.id,
            text: renderEvent(e.event, e.params, eventLabels(d.admin.events, d.admin.statuses), formatEuro),
            at: formatTimestamp(e.createdAt),
            by: e.by,
          }))}
        >
          {!isBespoke(r) && <RateCardPrice price={price} finalEuros={bookingTotalEuros(r)} copy={rd} names={d.addOns} />}
        </AutoPricingGateway>
      </div>

      {/* Two-column grid layout with balanced stack columns */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Left Column Stack */}
        <div className="flex min-h-0 w-full flex-col gap-6">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <MessagesCard requestId={r.id} guest={!r.corporateContactId} />
          </Suspense>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader title={d.admin.requestDetail.activity} description={d.admin.requestDetail.activityNote} icon={<ActivityIcon />} />
            <ol className="max-h-[350px] overflow-y-auto overscroll-contain p-5">
              {history.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < history.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-px bg-zinc-200" />}
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 ring-4 ring-white">
                    <span className={`size-2 rounded-full ${i === 0 ? "bg-zinc-950" : "bg-zinc-400"}`} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="wrap-break-word text-sm text-zinc-900">
                      {renderEvent(e.event, e.params, eventLabels(d.admin.events, d.admin.statuses), formatEuro)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatTimestamp(e.createdAt)}
                      {e.by ? ` · ${e.by}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Right Column Stack */}
        <div className="flex min-h-0 w-full flex-col gap-6">
          {canEditCars(r) && (
            <CarsEditor
              key={r.status}
              requestId={r.id}
              status={r.status}
              cars={FLEET.map((v) => ({ key: v.key, name: v.name, seats: v.specs?.passengers ?? null }))}
              initial={Object.fromEntries(
                (fleetPicks(r.vehicles).length > 0 ? fleetPicks(r.vehicles) : r.vehicle && normalizeVehicleKey(r.vehicle) ? [{ key: normalizeVehicleKey(r.vehicle)!, count: r.vehicleCount }] : []).map((p) => [p.key, p.count]),
              )}
              max={MAX_PER_CAR}
              copy={d.admin.review}
            />
          )}

          <Card className="flex flex-col overflow-hidden">
            <CardHeader title={d.admin.requestDetail.client} />
            <dl className="divide-y divide-zinc-100 p-5">
              <ContactRow icon={<MailIcon />} label={d.admin.common.email}>
                <a className="hover:underline" href={mailto}>{email || "—"}</a>
              </ContactRow>
              <ContactRow icon={<PhoneIcon />} label={d.admin.common.phone}>
                <a className="hover:underline" href={tel}>{phone || "—"}</a>
              </ContactRow>
            </dl>
          </Card>

          <DeleteRecord
            id={r.id}
            reference={r.reference}
            noun={d.admin.requestDetail.deleteNoun}
            action={deleteRequest}
            returnTo={fromEnquiries ? "/admin/enquiries" : "/admin/requests"}
            copy={{ title: d.admin.common.dangerZone, note: d.admin.common.dangerZoneNote, confirm: d.admin.common.deleteConfirm, deleting: d.admin.common.deleting }}
          />
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="mt-8 h-6 w-full" />
    </div>
  );
}
const isBespoke = (r: QuoteRequest) => r.service === "bespoke";
/** Cars can still be changed until the booking is confirmed. Quoted trips are included: approval has not happened yet. */
const canEditCars = (r: QuoteRequest) => !isBespoke(r) && (r.status === "new" || r.status === "contacted" || r.status === "quoted");

/** The rate card's price stored with the request (lib/pricing/rates.ts): each car's hours × rate, then VAT, the service fee and the total. */
function RateCardPrice({ price, finalEuros, copy: rd, names }: { price: Price | null; finalEuros: string | null; copy: Awaited<ReturnType<typeof adminDictionary>>["admin"]["requestDetail"]; names: ExtraNames }) {
  const euro = (cents: number) => formatEuro(cents / 100);
  const days = { weekday: rd.rateCardWeekday, saturday: rd.rateCardSaturday, sunday: rd.rateCardSunday };
  const line = (label: React.ReactNode, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 py-1.5 text-[13px] ${strong ? "mt-1 border-t border-zinc-100 pt-2.5 font-semibold text-zinc-950" : "text-zinc-600"}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-mono tabular-nums">{value}</span>
    </div>
  );
  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader title={rd.rateCardTitle} description={price ? `${price.segment === "corporate" ? rd.rateCardCorporate : rd.rateCardPublic} · ${rd.rateCardNote}` : rd.rateCardNone} />
      {price && (
        <div className="px-5 py-4">
          {(Array.isArray(price.legs) ? price.legs : []).map((leg) => (
            <div key={leg?.leg} className="pb-2">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{interpolate(leg?.leg === "return" ? rd.rateCardReturn : rd.rateCardOutward, { day: leg?.day ? days[leg.day] : "" })}</p>
              {(Array.isArray(leg?.lines) ? leg.lines : []).map((l) => {
                // A leg that runs into the weekend is billed at each day's rate
                const part = lineDay(leg, l);
                const text = interpolate(rd.rateCardLine, { count: l.count, car: vehicleByKey(l.key)?.name ?? l.key, hours: part.hours, rate: euro(l.rate) });
                return <div key={`${l.key}-${part.day}`}>{line(legSpansDays(leg) ? `${text} · ${days[part.day]}` : text, euro(l.amount))}</div>;
              })}
              {(Array.isArray(leg?.km?.lines) ? leg.km.lines : []).map((k) => (
                <div key={`${k.key}-km`}>
                  {line(interpolate(rd.rateCardKm, { count: k.count, car: vehicleByKey(k.key)?.name ?? k.key, extra: k.extra, rate: euro(k.rate), distance: leg?.km?.distance ?? 0, included: k.included }), euro(k.amount))}
                </div>
              ))}
            </div>
          ))}
          {(Array.isArray(price.extras) ? price.extras : []).filter((e) => e && typeof e === "object").map((e) => (
            <div key={e.key}>{line(`${e.count} × ${extraName(names, e)} (${Math.round((e.vatRate ?? 0) * 100)}% BTW)`, euro(e.amount))}</div>
          ))}
          {line(rd.rateCardVat, euro(vatByRate(price).low))}
          {line(rd.rateCardFee, euro(price.fee))}
          {vatByRate(price).high ? line(hasHighRateExtras(price) ? rd.rateCardVatHigh : rd.rateCardFeeVat, euro(vatByRate(price).high)) : null}
          {line(rd.rateCardTotal, finalEuros != null ? formatEuro(finalEuros) : euro(price.total), true)}
        </div>
      )}
    </Card>
  );
}