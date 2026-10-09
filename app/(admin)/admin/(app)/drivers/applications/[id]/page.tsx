import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getApplication } from "@/lib/admin/applications";
import { formatDate, formatRelative, formatTimestamp } from "@/lib/admin/format";
import { amsterdamToday, colourLabel, DECLARATIONS, DOCUMENTS, makeLabel, vehicleChecks, type ApplicationDocument } from "@/lib/partners/criteria";
import { lookupVehicle } from "@/lib/partners/rdw";
import { signedDownloadUrl } from "@/lib/storage";
import { DeleteRecord } from "../../../../_components/delete-record";
import {
  AlertIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  RefreshIcon,
  SteeringIcon,
  XIcon,
} from "../../../../_components/icons";
import { ApplicationBadge } from "../../../../_components/status-badge";
import { Avatar, btn, Card, CardHeader, PageBody, Skeleton } from "../../../../_components/ui";
import { SubmitButton } from "../../submit-button";
import { deleteApplication, refreshVehicle } from "../actions";
import { ReviewForm } from "./review-form";

export default function ApplicationPage({ params }: PageProps<"/admin/drivers/applications/[id]">) {
  return (
    <PageBody>
      <Link
        href="/admin/drivers/applications"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950"
      >
        <ArrowLeftIcon size={14} />
        All applications
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <ApplicationDetail params={params} />
      </Suspense>
    </PageBody>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-zinc-900">{children}</dd>
    </div>
  );
}

async function ApplicationDetail({ params }: Pick<PageProps<"/admin/drivers/applications/[id]">, "params">) {
  const { id } = await params;
  const data = await getApplication(id);
  if (!data) notFound();
  const { application: a, reviewer } = data;
  const tel = `tel:${a.phone.replace(/\s/g, "")}`;
  const waNumber = a.phone.replace(/[^\d]/g, "");
  const mailto = `mailto:${a.email}?subject=${encodeURIComponent(`Your Ecram Execs driver application ${a.reference}`)}`;

  return (
    <div className="mt-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={a.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{a.name}</h1>
              <ApplicationBadge status={a.status} size="md" />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{a.reference}</span>
              <span aria-hidden="true">·</span>
              <span title={formatTimestamp(a.createdAt)}>Applied {formatRelative(a.createdAt)}</span>
              {a.reviewedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Reviewed {formatTimestamp(a.reviewedAt)}
                    {reviewer ? ` by ${reviewer}` : ""}
                  </span>
                </>
              )}
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
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className={`${btn.base} ${btn.md} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}
            >
              <ChatIcon /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {a.status === "approved" && a.driverId && (
        <Link
          href="/admin/drivers"
          className="mt-6 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100/70"
        >
          <CheckCircleIcon className="shrink-0 text-emerald-600" />
          Approved — {a.name} is on the drivers board as a partner.
          <span className="ml-auto font-medium">Open drivers →</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Vehicle */}
          <Card>
            <CardHeader
              title="Vehicle"
              description={a.rdwCheckedAt ? `From the RDW register, ${formatTimestamp(a.rdwCheckedAt)}` : "Not verified — the RDW was unavailable at submission"}
              icon={<SteeringIcon />}
              actions={
                <span className="rounded border border-[#1d3f8f]/30 bg-[#eef2fb] px-2 py-1 font-mono text-xs font-semibold tracking-wider text-[#1d3f8f]">
                  {a.plate}
                </span>
              }
            />
            <div className="p-5">
              {a.rdwCheckedAt ? (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <div className="divide-y divide-zinc-100">
                    <Row label="Make & model">
                      {makeLabel(a.make ?? "")} {a.model}
                    </Row>
                    <Row label="Colour">{colourLabel(a.colour ?? "")}</Row>
                    <Row label="Seats (incl. driver)">{a.seats ?? "—"}</Row>
                  </div>
                  <div className="divide-y divide-zinc-100 max-sm:mt-2.5 max-sm:border-t max-sm:border-zinc-100 max-sm:pt-2.5">
                    <Row label="First registered">{formatDate(a.firstRegistered)}</Row>
                    <Row label="APK expires">{formatDate(a.apkExpires)}</Row>
                    <Row label="Taxi registration">{a.taxiRegistered ? "Yes" : "No"}</Row>
                  </div>
                </dl>
              ) : (
                <form action={refreshVehicle} className="flex flex-col items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                  <input type="hidden" name="id" value={a.id} />
                  <p className="flex gap-2">
                    <AlertIcon className="mt-0.5 shrink-0" />
                    The RDW register couldn&apos;t be reached when this application was submitted, so the car hasn&apos;t been checked yet.
                  </p>
                  <SubmitButton pendingText="Checking…" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                    <RefreshIcon size={14} /> Fetch from RDW
                  </SubmitButton>
                </form>
              )}
              {a.openRecall && (
                <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                  <AlertIcon className="mt-0.5 shrink-0" />
                  The RDW lists an open recall for this car. Ask the driver to show it has been resolved.
                </p>
              )}
            </div>
          </Card>

          <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
            <LiveCheck plate={a.plate} />
          </Suspense>

          {a.documents && (
            <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
              <Documents documents={a.documents} />
            </Suspense>
          )}

          {/* Driver */}
          <Card>
            <CardHeader title="Driver" icon={<BriefcaseIcon />} />
            <div className="p-5">
              <dl className="divide-y divide-zinc-100">
                <Row label="Professional experience">{a.experienceYears} years</Row>
                <Row label="KvK number">
                  <a
                    href={`https://www.kvk.nl/zoeken/?source=all&q=${a.kvk}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                  >
                    {a.kvk}
                  </a>
                </Row>
              </dl>
              <p className="mt-5 text-xs font-medium text-zinc-500">Confirmed by the applicant — verify in person</p>
              <ul className="mt-2 flex flex-col gap-2">
                {DECLARATIONS.map((d) => (
                  <li key={d.name} className="flex gap-2 text-sm text-zinc-800">
                    <CheckIcon size={14} className="mt-1 shrink-0 text-zinc-400" />
                    {d.label}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <NoteIcon size={14} /> Notes from the applicant
                </p>
                {a.notes ? (
                  <p className="mt-2 whitespace-pre-wrap break-words border-l-2 border-zinc-300 pl-3 text-sm leading-relaxed text-zinc-800">
                    {a.notes}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No notes.</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader title="Review" description="Approve once documents and the car have been checked in person" />
            <div className="p-5">
              <ReviewForm key={a.updatedAt.toISOString()} id={a.id} status={a.status} internalNotes={a.internalNotes} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Contact" />
            <dl className="divide-y divide-zinc-100 p-5">
              <Row label="Email">
                <a className="hover:underline" href={mailto}>
                  {a.email}
                </a>
              </Row>
              <Row label="Phone">
                <a className="hover:underline" href={tel}>
                  {a.phone}
                </a>
              </Row>
              <Row label="Applied">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-zinc-400" />
                  {formatTimestamp(a.createdAt)}
                </span>
              </Row>
            </dl>
          </Card>

          <DeleteRecord id={a.id} reference={a.reference} noun="application" action={deleteApplication} />
        </div>
      </div>
    </div>
  );
}

const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** The uploaded documents, as links that expire after ten minutes (the bucket is private). */
async function Documents({ documents }: { documents: ApplicationDocument[] }) {
  const links = await Promise.all(
    documents.map((d) =>
      signedDownloadUrl(d.path).catch((err) => {
        console.error(`[admin] could not sign ${d.path}`, err);
        return null;
      }),
    ),
  );
  return (
    <Card>
      <CardHeader title="Documents" description="Uploaded by the applicant — compare with the originals in person" icon={<NoteIcon />} />
      <ul className="divide-y divide-zinc-100">
        {DOCUMENTS.map((d) => {
          const i = documents.findIndex((doc) => doc.name === d.name);
          const doc = documents[i];
          return (
            <li key={d.name} className="flex items-center gap-3 px-5 py-2.5">
              <span className="flex-1 text-sm text-zinc-900">
                {d.label} <span className="text-zinc-500">· {d.hint}</span>
              </span>
              {!doc ? (
                <span className="text-[13px] text-zinc-400">Not uploaded</span>
              ) : links[i] ? (
                <a
                  href={links[i]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                >
                  Open {doc.path.split(".").pop()?.toUpperCase()} · {fileSize(doc.size)}
                </a>
              ) : (
                <span className="text-[13px] text-red-700">Unavailable — reload to try again</span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Checks the car against today's criteria, straight from the RDW (APK and insurance can lapse after applying). */
async function LiveCheck({ plate }: { plate: string }) {
  const vehicle = await lookupVehicle(plate);
  const checks = vehicle && vehicle !== "unavailable" ? vehicleChecks(vehicle, amsterdamToday()) : null;
  const passed = checks?.every((c) => c.ok);
  return (
    <Card>
      <CardHeader
        title="Criteria check"
        description="Live from the RDW register"
        icon={<CheckCircleIcon />}
        actions={
          checks && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                passed ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-800 ring-red-200"
              }`}
            >
              {passed ? "Meets criteria" : `${checks.filter((c) => !c.ok).length} not met`}
            </span>
          )
        }
      />
      {checks ? (
        <ul className="divide-y divide-zinc-100">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 px-5 py-2.5">
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${c.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                aria-label={c.ok ? "Met" : "Not met"}
              >
                {c.ok ? <CheckIcon size={12} /> : <XIcon size={12} />}
              </span>
              <span className="flex-1 text-sm text-zinc-900">{c.label}</span>
              <span className={`text-right text-[13px] ${c.ok ? "text-zinc-500" : "font-medium text-red-700"}`}>{c.found}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-sm text-zinc-500">
          {vehicle === null ? "This plate is no longer in the RDW register." : "The RDW register can't be reached right now. Reload to try again."}
        </p>
      )}
    </Card>
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
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
