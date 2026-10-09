import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, pickupInstant, pickupParts, STATUS_LABEL } from "@/lib/admin/format";
import { getRequest } from "@/lib/admin/queries";
import type { RequestStatus } from "@/lib/quotes/constants";
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
import { UpdateForm } from "./update-form";

export default function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  return (
    <PageBody>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
        <ArrowLeftIcon size={14} />
        All requests
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <RequestDetail params={params} />
      </Suspense>
    </PageBody>
  );
}

const PIPELINE: RequestStatus[] = ["new", "contacted", "quoted", "confirmed", "completed"];

function Pipeline({ status }: { status: RequestStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        This request was cancelled. Change the status in the panel to reopen it.
      </div>
    );
  }
  const at = PIPELINE.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Progress">
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
              {STATUS_LABEL[s]}
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
      <span className="mt-0.5 text-zinc-400">{icon}</span>
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
  const { request: r, events } = data;
  const waNumber = r.phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Dear ${r.name}, thank you for your request ${r.reference} with Ecram Execs.`);
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent(`Your Ecram Execs quotation ${r.reference}`)}`;
  const tel = `tel:${r.phone.replace(/\s/g, "")}`;
  const pickup = pickupParts(r.pickupAt);
  const pickupAt = pickupInstant(r.pickupAt);

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
            <CardHeader title="Journey" description={r.service} icon={<BriefcaseIcon />} />
            <div className="p-5">
              <ol className="relative">
                <span aria-hidden="true" className="absolute bottom-6 left-[7px] top-6 w-px bg-[repeating-linear-gradient(to_bottom,#d4d4d8_0_4px,transparent_4px_8px)]" />
                <li className="relative flex gap-4 pb-6">
                  <span aria-hidden="true" className="mt-1 size-[15px] shrink-0 rounded-full border-[3px] border-zinc-950 bg-white" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Collection</p>
                    <p className="mt-0.5 wrap-break-word text-[15px] font-medium text-zinc-950">{r.collection}</p>
                  </div>
                </li>
                <li className="relative flex gap-4">
                  <span aria-hidden="true" className="mt-1 size-[15px] shrink-0 rounded-full bg-zinc-950 ring-4 ring-zinc-200" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Destination</p>
                    <p className="mt-0.5 wrap-break-word text-[15px] font-medium text-zinc-950">{r.destination}</p>
                  </div>
                </li>
              </ol>

              <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg bg-zinc-50 p-4 sm:grid-cols-3">
                <Meta icon={<CalendarIcon />} label="Pick-up date (NL)">
                  {pickup.date}
                </Meta>
                <Meta icon={<ClockIcon />} label="Pick-up time">
                  {pickup.time} <span className="font-normal text-zinc-500">· {formatRelative(pickupAt)}</span>
                </Meta>
                <Meta icon={<UsersIcon />} label="Passengers">
                  {r.passengers ?? "—"}
                </Meta>
              </dl>

              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <NoteIcon size={14} /> Client notes
                </p>
                {r.notes ? (
                  <p className="mt-2 whitespace-pre-wrap wrap-break-word border-l-2 border-zinc-300 bg-white pl-3 text-sm leading-relaxed text-zinc-800">
                    {r.notes}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No notes from the client.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Activity" description="Every change made by the team" icon={<ActivityIcon />} />
            <ol className="p-5">
              {events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < events.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-px bg-zinc-200" />}
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 ring-4 ring-white">
                    <span className={`size-2 rounded-full ${i === 0 ? "bg-zinc-950" : "bg-zinc-400"}`} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="wrap-break-word text-sm text-zinc-900">{e.message}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatTimestamp(e.createdAt)}
                      {e.by ? ` · ${e.by}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {events.length === 0 && <li className="text-sm text-zinc-500">No activity yet.</li>}
            </ol>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader title="Manage request" description="Changes are logged in the activity feed" />
            <div className="p-5">
              <UpdateForm key={r.updatedAt.toISOString()} id={r.id} status={r.status} quotedAmount={r.quotedAmount} internalNotes={r.internalNotes} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Client" />
            <dl className="divide-y divide-zinc-100 p-5">
              <ContactRow icon={<MailIcon />} label="Email">
                <a className="hover:underline" href={mailto}>
                  {r.email}
                </a>
              </ContactRow>
              <ContactRow icon={<PhoneIcon />} label="Phone">
                <a className="hover:underline" href={tel}>
                  {r.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<EuroIconText />} label="Quoted amount">
                <span className="font-medium tabular-nums">{formatEuro(r.quotedAmount)}</span>
              </ContactRow>
              <ContactRow icon={<CalendarIcon />} label="Received">
                {formatTimestamp(r.createdAt)}
              </ContactRow>
            </dl>
          </Card>

          <DeleteRecord id={r.id} reference={r.reference} noun="request" action={deleteRequest} />
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
