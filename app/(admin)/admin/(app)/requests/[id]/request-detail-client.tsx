"use client";

import { useState } from "react";
import { FLEET, normalizeVehicleKey, vehicleByKey } from "@/lib/fleet/vehicles";
import { formatEuro, formatRelative, formatTimestamp } from "@/lib/admin/format";
import { serviceLabel, type RequestStatus } from "@/lib/quotes/constants";
import { eventLabels, renderEvent } from "@/lib/admin/events";
import { interpolate } from "@/lib/i18n/interpolate";
import type { QuoteRequest } from "@/lib/db/schema";
import {
  ActivityIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  MailIcon,
  PhoneIcon,
} from "../../../_components/icons";
import { StatusBadge, UrgentBadge } from "../../../_components/status-badge";
import { Avatar, btn, Card, CardHeader } from "../../../_components/ui";
import { deleteRequest } from "../../../actions";
import { DeleteRecord } from "../../../_components/delete-record";
import { PartnerCard } from "./partner-card";
import { tripMinutes } from "@/lib/fleet/schedule";
import { AssignVehicle } from "./assign-vehicle";
import { browserMapKey, routeMapLinks } from "@/lib/fleet/map";
import { AutoPricingGateway } from "../../../_components/auto-pricing-gateway";
import type { Price } from "@/lib/pricing/rates";

const PIPELINE: RequestStatus[] = ["new", "confirmed", "completed", "cancelled"];

function Pipeline({ status }: { status: RequestStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Request has been cancelled.
      </div>
    );
  }
  const at = status === "contacted" || status === "quoted" ? 0 : PIPELINE.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
      {PIPELINE.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s} aria-current={current ? "step" : undefined} className="min-w-0">
            <span className={`block h-1 rounded-full ${i <= at ? "bg-zinc-950" : "bg-zinc-200"}`} />
            <span
              className={`mt-2 flex items-center gap-1 truncate text-[11px] font-medium sm:text-xs ${
                current ? "text-zinc-950" : done ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              {done && <CheckIcon size={12} className="hidden shrink-0 sm:block" />}
              {s}
            </span>
          </li>
        );
      })}
    </ol>
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

export function RequestDetailClient({ initialData, dictionary }: { initialData: any; dictionary: any }) {
  const { request: r, events } = initialData as { 
    request: QuoteRequest; 
    events: Array<{ id: string; event: string; params: Record<string, string | number | null>; createdAt: Date; by: string | null }> 
  };
  const d = dictionary;
  const waNumber = r.phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Dear ${r.name}, thank you for your request ${r.reference} with Ecram Execs.`);
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent(`Your Ecram Execs booking ${r.reference}`)}`;
  const tel = `tel:${r.phone.replace(/\s/g, "")}`;
  const rd = d.admin.requestDetail;
  const links = routeMapLinks(r, browserMapKey());
  const routeMap = links ? { ...links, openLabel: rd.routeOpen, noKey: rd.routeNoKey, frameTitle: rd.routeFrameTitle } : null;

  return (
    <div className="mt-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={r.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{r.name}</h1>
              <StatusBadge status={r.status} size="md" />
              <UrgentBadge request={r} size="md" />
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
        <Pipeline status={r.status} />
      </div>

      <div className="mt-6">
        <AutoPricingGateway request={r} copy={d.admin.pricing} statuses={d.admin.statuses} routeMap={routeMap}>
          {!isBespoke(r) && <RateCardPrice price={r.priceEstimate} requestId={r.id} copy={rd} />}
        </AutoPricingGateway>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title={d.admin.requestDetail.activity} description={d.admin.requestDetail.activityNote} icon={<ActivityIcon />} />
            <ol className="p-5">
              {events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < events.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-px bg-zinc-200" />}
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

        {/* Sidebar */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <PartnerCard requestId={r.id} />

          <Card>
            <CardHeader title={d.admin.schedule.carTitle} icon={<CalendarIcon />} />
            <AssignVehicle
              id={r.id}
              vehicle={r.vehicle === "advise" ? "advise" : (normalizeVehicleKey(r.vehicle) ?? "")}
              confirmed={r.status === "confirmed"}
              scheduleHref={r.pickupAt ? `/admin/requests/schedule?date=${r.pickupAt.slice(0, 10)}` : null}
              tripNote={(r.blockMinutes ? d.admin.schedule.tripRoute : d.admin.schedule.tripEstimate).replace(
                "{minutes}",
                String(tripMinutes({ service: r.service, durationHours: r.durationHours, blockMinutes: r.blockMinutes })),
              )}
              cars={FLEET.map((v) => ({ key: v.key, name: v.name }))}
              copy={d.admin.schedule}
            />
          </Card>

          <Card>
            <CardHeader title={d.admin.requestDetail.client} />
            <dl className="divide-y divide-zinc-100 p-5">
              <ContactRow icon={<MailIcon />} label={d.admin.common.email}>
                <a className="hover:underline" href={mailto}>{r.email}</a>
              </ContactRow>
              <ContactRow icon={<PhoneIcon />} label={d.admin.common.phone}>
                <a className="hover:underline" href={tel}>{r.phone}</a>
              </ContactRow>
            </dl>
          </Card>

          <DeleteRecord
            id={r.id}
            reference={r.reference}
            noun={d.admin.requestDetail.deleteNoun}
            action={deleteRequest}
            copy={{ title: d.admin.common.dangerZone, note: d.admin.common.dangerZoneNote, confirm: d.admin.common.deleteConfirm, deleting: d.admin.common.deleting }}
          />
        </div>
      </div>
    </div>
  );
}

const isBespoke = (r: QuoteRequest) => r.service === "bespoke";

function RateCardPrice({ price, requestId, copy: rd }: { price: Price | null; requestId: string; copy: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<Price | null>(price);
  const [loading, setLoading] = useState(false);

  const euro = (cents: number) => formatEuro(cents / 100);
  const days = { weekday: rd.rateCardWeekday, saturday: rd.rateCardSaturday, sunday: rd.rateCardSunday };

  const handleSave = async () => {
    if (!currentPrice) return;
    try {
      setLoading(true);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save price:", error);
    } finally {
      setLoading(false);
    }
  };

  const line = (label: React.ReactNode, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 py-1.5 text-[13px] ${strong ? "mt-1 border-t border-zinc-100 pt-2.5 font-semibold text-zinc-950" : "text-zinc-600"}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-mono tabular-nums">{value}</span>
    </div>
  );

  const actions = currentPrice ? (
    isEditing ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-zinc-950 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Edit
      </button>
    )
  ) : undefined;

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader
        title={rd.rateCardTitle}
        description={currentPrice ? `${currentPrice.segment === "corporate" ? rd.rateCardCorporate : rd.rateCardPublic} · ${rd.rateCardNote}` : rd.rateCardNone}
        actions={actions}
      />

      {currentPrice && (
        <div className="px-5 py-4">
          {currentPrice.legs.map((leg, legIdx) => (
            <div key={leg.leg} className="pb-2">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                {interpolate(leg.leg === "return" ? rd.rateCardReturn : rd.rateCardOutward, { day: days[leg.day] })}
              </p>
              {leg.lines.map((l, lineIdx) => (
                <div key={l.key} className="flex items-center justify-between py-1.5 text-[13px] text-zinc-600">
                  <span>{interpolate(rd.rateCardLine, { count: l.count, car: vehicleByKey(l.key)?.name ?? l.key, hours: leg.hours, rate: euro(l.rate) })}</span>
                  
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-zinc-300 px-1.5 py-0.5 text-right font-mono text-xs"
                        value={l.amount / 100}
                        onChange={(e) => {
                          const newAmount = Math.round(parseFloat(e.target.value || "0") * 100);
                          const updatedLegs = [...currentPrice.legs];
                          updatedLegs[legIdx].lines[lineIdx].amount = newAmount;
                          
                          const totalBase = updatedLegs.reduce((acc, l) => acc + l.lines.reduce((a, cur) => a + cur.amount, 0), 0);
                          const newVat = Math.round(totalBase * 0.09);
                          const newTotal = totalBase + newVat + currentPrice.fee + (currentPrice.feeVat || 0);

                          setCurrentPrice({ 
                            ...currentPrice, 
                            legs: updatedLegs,
                            vat: newVat,
                            total: newTotal
                          });
                        }}
                      />
                    </div>
                  ) : (
                    <span className="shrink-0 font-mono tabular-nums">{euro(l.amount)}</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {line(rd.rateCardVat, euro(currentPrice.vat))}
          {line(rd.rateCardFee, euro(currentPrice.fee))}
          {currentPrice.feeVat ? line(rd.rateCardFeeVat, euro(currentPrice.feeVat)) : null}
          {line(rd.rateCardTotal, euro(currentPrice.total), true)}
          
        </div>
      )}
    </Card>
  );
}