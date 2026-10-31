export const instant = false;
import Link from "next/link";
import { FLEET, normalizeVehicleKey, vehicleByKey } from "@/lib/fleet/vehicles";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, pickupInstant, pickupParts } from "@/lib/admin/format";
import { chatForRequest } from "@/lib/admin/chats";
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
import { StatusBadge, UrgentBadge } from "../../../_components/status-badge";
import { Avatar, btn, Card, CardHeader, PageBody, Skeleton } from "../../../_components/ui";
import { deleteRequest } from "../../../actions";
import { DeleteRecord } from "../../../_components/delete-record";
import { PartnerCard } from "./partner-card";
import { tripMinutes } from "@/lib/fleet/schedule";
import { AssignVehicle } from "./assign-vehicle";
import { AutoPricingGateway } from "../../../_components/auto-pricing-gateway";

async function BackLabel() {
  const { admin } = await adminDictionary();
  return admin.common.backToRequests;
}

export default function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  return (
    <PageBody>
      <Link href="/admin/requests" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
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

const PIPELINE: RequestStatus[] = ["new", "contacted", "quoted", "confirmed", "completed", "cancelled"];

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
    <ol className="grid grid-cols-6 gap-1" aria-label={t.common.progress}>
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
              {t.statuses[s] ?? s}
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

async function RequestDetail({ params }: Pick<PageProps<"/admin/requests/[id]">, "params">) {
  const { id } = await params;
  const data = await getRequest(id);
  if (!data) notFound();
  const { request: r, events } = data as { 
    request: QuoteRequest; 
    events: Array<{ id: string; event: string; params: Record<string, string | number | null>; createdAt: Date; by: string | null }> 
  };
  const d = await adminDictionary();
  const chatId = await chatForRequest(r.id);
  const waNumber = r.phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Dear ${r.name}, thank you for your request ${r.reference} with Ecram Execs.`);
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent(`Your Ecram Execs quotation ${r.reference}`)}`;
  const tel = `tel:${r.phone.replace(/\s/g, "")}`;
  const rd = d.admin.requestDetail;

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
        <Pipeline status={r.status} />
      </div>

      {/* Auto-Pricing Gateway */}
      <div className="mt-6">
        <AutoPricingGateway request={r} copy={d.admin.pricing} statuses={d.admin.statuses} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
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