import Link from "next/link";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, pickupInstant, pickupParts } from "@/lib/admin/format";
import { getRequest } from "@/lib/admin/queries";
import { serviceLabel, type RequestStatus } from "@/lib/quotes/constants";
import { eventLabels, renderEvent } from "@/lib/admin/events";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { stopsWithWaits } from "@/lib/quotes/stops";
import type { QuoteRequest } from "@/lib/db/schema";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  UsersIcon,
} from "../../../_components/icons";
import { StatusBadge } from "../../../_components/status-badge";
import { Avatar, btn, Card, CardHeader, PageBody, Skeleton } from "../../../_components/ui";
import { deleteRequest } from "../../../actions";
import { DeleteRecord } from "../../../_components/delete-record";
import { InvoicesCard } from "./invoices-card";
import { MessagesCard } from "./messages-card";
import { PartnerCard } from "./partner-card";
import { UpdateForm } from "./update-form";

async function BackLabel() {
  const { admin } = await adminDictionary();
  return admin.common.backToRequests;
}

export default function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  return (
    <PageBody>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
        <ArrowLeftIcon size={14} />
        <Suspense fallback={<span className="inline-block h-[1em] w-28 animate-pulse rounded bg-zinc-100 align-middle" />}>
          <BackLabel />
        </Suspense>
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <RequestDetail params={params} />
      </Suspense>
    </PageBody>
  );
}
export const instant = false;
const PIPELINE: RequestStatus[] = ["new", "contacted", "quoted", "confirmed", "completed"];

async function Pipeline({ status }: { status: RequestStatus }) {
  const { admin: t } = await adminDictionary();
  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        {t.requestDetail.cancelledNote}
      </div>
    );
  }
  const at = PIPELINE.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={t.common.progress}>
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
              {t.statuses[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-zinc-500">{label}</dt>
        <dd className="mt-0.5 wrap-break-word text-sm font-medium text-zinc-900">{children}</dd>
      </div>
    </div>
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

async function RequestDetail({ params }: Pick<PageProps<"/admin/requests/[id]">, "params">) {
  const { id } = await params;
  const data = await getRequest(id);
  if (!data) notFound();
  const { request: r, events } = data as { 
    request: QuoteRequest; 
    events: Array<{ id: string; event: string; params: Record<string, string | number | null>; createdAt: Date; by: string | null }> 
  };
  const d = await adminDictionary();
  const serviceLabels = d.services;
  const waNumber = r.phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Dear ${r.name}, thank you for your request ${r.reference} with Ecram Execs.`);
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent(`Your Ecram Execs quotation ${r.reference}`)}`;
  const tel = `tel:${r.phone.replace(/\s/g, "")}`;
  const bespoke = r.service === "bespoke";
  const pickup = r.pickupAt ? pickupParts(r.pickupAt) : null;
  const pickupAt = r.pickupAt ? pickupInstant(r.pickupAt) : null;
  const rd = d.admin.requestDetail;
  const bespokeCopy = d.bespokeSection;

  const allStops = bespoke
    ? []
    : // from, stops on the way (each with how long the chauffeur waits), to
      [
        { text: r.collection, wait: 0 },
        ...stopsWithWaits(r.destinations, r.destinationWaits).map((s) => ({ text: s.place, wait: s.wait })),
        { text: r.destination, wait: 0 },
      ].filter((s) => s.text);

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
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{r.reference}</span>
              <span aria-hidden="true">·</span>
              <span title={formatTimestamp(r.createdAt)}>Received {formatRelative(r.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span>via {r.source}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <a href={mailto} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <MailIcon /> Email
          </a>
          <a href={tel} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <PhoneIcon /> Call
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Journey */}
          <Card>
            <CardHeader title={d.admin.requestDetail.journey} description={serviceLabel(r.service, serviceLabels)} icon={<BriefcaseIcon />} />
            <div className="p-5">
              {bespoke ? (
                <>
                  <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4 rounded-lg bg-zinc-50 p-4">
                    <Meta icon={<BriefcaseIcon />} label={rd.entity}>
                      {r.entity ?? "—"}
                    </Meta>
                    <Meta icon={<UsersIcon />} label={rd.delegationSize}>
                      {r.passengers ?? "—"}
                    </Meta>
                    <Meta icon={<BriefcaseIcon />} label={rd.vehicleClass}>
                      {r.vehicleClass ? ((bespokeCopy.vehicleClasses as Record<string, string>)[r.vehicleClass] ?? r.vehicleClass) : "—"}
                    </Meta>
                    <Meta icon={<ChatIcon />} label={rd.contactPreference}>
                      {r.contactPreference ? ((bespokeCopy.contactOptions as Record<string, string>)[r.contactPreference] ?? r.contactPreference) : "—"}
                    </Meta>
                  </dl>
                  <div className="mt-5">
                    <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <NoteIcon size={14} /> {rd.itinerary}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap wrap-break-word border-l-2 border-zinc-300 bg-white pl-3 text-sm leading-relaxed text-zinc-800">
                      {r.itinerary}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ol className="relative flex flex-col gap-3 py-1">
                    {allStops.map((stop, i, arr) => {
                      const isFirst = i === 0;
                      const isLast = i === arr.length - 1;

                      return (
                        <li key={i} className="relative flex items-center gap-4">
                          <span aria-hidden="true" className="relative flex size-4 shrink-0 items-center justify-center">
                            {!isFirst && (
                              <span className="absolute -top-3.5 left-[7px] h-4 w-px bg-zinc-300" />
                            )}
                            <span
                              className={`size-2 rounded-full ${
                                isFirst
                                  ? "size-[15px] rounded-full border-[3px] border-zinc-950 bg-white"
                                  : isLast
                                  ? "size-[15px] rounded-full bg-zinc-950 ring-4 ring-zinc-200"
                                  : "size-2 bg-zinc-900 ring-2 ring-zinc-100"
                              }`}
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                              {isFirst ? d.admin.requestDetail.collection : isLast ? d.admin.requestDetail.destination : `Stopover ${i}`}
                            </p>
                            <p className="mt-0.5 wrap-break-word text-[15px] font-medium text-zinc-950">{stop.text}</p>
                            {stop.wait > 0 && <p className="mt-0.5 text-xs text-zinc-500">{interpolate(d.admin.requestDetail.stopWait, { minutes: stop.wait })}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4 rounded-lg bg-zinc-50 p-4">
                    <Meta icon={<CalendarIcon />} label={d.admin.requestDetail.pickupDate}>
                      {pickup?.date}
                    </Meta>
                    <Meta icon={<ClockIcon />} label={d.admin.requestDetail.pickupTime}>
                      {pickup?.time} <span className="font-normal text-zinc-500">· {pickupAt ? formatRelative(pickupAt) : ""}</span>
                    </Meta>
                    <Meta icon={<UsersIcon />} label={d.admin.requestDetail.passengers}>
                      {r.passengers ?? "—"}
                    </Meta>
                    <Meta icon={<BriefcaseIcon />} label={rd.vehicle}>
                      {r.vehicle ? (vehicleByKey(r.vehicle)?.name ?? (r.vehicle === "advise" ? d.quoteForm.vehicleAdvise : r.vehicle)) : "—"}
                    </Meta>
                  </dl>
                </>
              )}

              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <NoteIcon size={14} /> Client notes
                </p>
                {r.notes ? (
                  <p className="mt-2 whitespace-pre-wrap wrap-break-word border-l-2 border-zinc-300 bg-white pl-3 text-sm leading-relaxed text-zinc-800">
                    {r.notes}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">{d.admin.requestDetail.noNotes}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Activity */}
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
              {events.length === 0 && <li className="text-sm text-zinc-500">{d.admin.requestDetail.noActivity}</li>}
            </ol>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader title={d.admin.requestDetail.manage} description={d.admin.requestDetail.manageNote} />
            <div className="p-5">
              <UpdateForm
                key={r.updatedAt.toISOString()}
                id={r.id}
                status={r.status}
                quotedAmount={r.quotedAmount}
                internalNotes={r.internalNotes}
                statusLabels={d.admin.statuses}
                copy={{
                  save: d.admin.common.save,
                  saving: d.admin.common.saving,
                  status: d.admin.requestDetail.fieldStatus,
                  quotedAmount: d.admin.requestDetail.fieldQuotedAmountEur,
                  internalNotes: d.admin.requestDetail.fieldInternalNotes,
                  amountPlaceholder: d.admin.requestDetail.amountPlaceholder,
                  internalPlaceholder: d.admin.requestDetail.internalPlaceholder,
                }}
              />
            </div>
          </Card>

          <PartnerCard requestId={r.id} />
          <MessagesCard requestId={r.id} linked={!!r.corporateContactId} />
          <InvoicesCard requestId={r.id} linked={!!r.corporateContactId} />

          <Card>
            <CardHeader title={d.admin.requestDetail.client} />
            <dl className="divide-y divide-zinc-100 p-5">
              <ContactRow icon={<MailIcon />} label={d.admin.common.email}>
                <a className="hover:underline" href={mailto}>
                  {r.email}
                </a>
              </ContactRow>
              <ContactRow icon={<PhoneIcon />} label={d.admin.common.phone}>
                <a className="hover:underline" href={tel}>
                  {r.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<EuroIconText />} label={d.admin.requestDetail.quotedAmount}>
                <span className="font-medium tabular-nums">{formatEuro(r.quotedAmount)}</span>
              </ContactRow>
              <ContactRow icon={<CalendarIcon />} label={d.admin.requestDetail.received}>
                {formatTimestamp(r.createdAt)}
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

function EuroIconText() {
  return <span className="text-sm font-semibold">€</span>;
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
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}