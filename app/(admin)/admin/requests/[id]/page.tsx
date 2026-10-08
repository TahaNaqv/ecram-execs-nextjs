import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatEuro, formatPickup, formatTimestamp } from "@/lib/admin/format";
import { getRequest } from "@/lib/admin/queries";
import { AdminHeader, AdminHeaderFallback } from "../../_components/admin-header";
import { StatusBadge } from "../../_components/status-badge";
import { DeleteRequest } from "./delete-request";
import { UpdateForm } from "./update-form";

export default function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  return (
    <>
      <Suspense fallback={<AdminHeaderFallback />}>
        <AdminHeader />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← All requests
        </Link>
        <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading request…</p>}>
          <RequestDetail params={params} />
        </Suspense>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t sm:grid-cols-[140px_1fr] sm:gap-4 border-zinc-100 py-3 text-sm first:border-t-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-zinc-900">{children}</dd>
    </div>
  );
}

async function RequestDetail({ params }: Pick<PageProps<"/admin/requests/[id]">, "params">) {
  const { id } = await params;
  const data = await getRequest(id);
  if (!data) notFound();
  const { request: r, events } = data;
  const waNumber = r.phone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(
    `Dear ${r.name}, thank you for your request ${r.reference} with Ecram Execs.`,
  );

  return (
    <div className="mt-4 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{r.name}</h1>
          <StatusBadge status={r.status} />
          <span className="font-mono text-sm text-zinc-400">{r.reference}</span>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">Journey</h2>
          <dl>
            <Row label="Service">{r.service}</Row>
            <Row label="Pick-up (NL time)">{formatPickup(r.pickupAt)}</Row>
            <Row label="Collection">{r.collection}</Row>
            <Row label="Destination">{r.destination}</Row>
            <Row label="Passengers">{r.passengers ?? "—"}</Row>
            <Row label="Client notes">{r.notes ?? "—"}</Row>
          </dl>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">Client</h2>
          <dl>
            <Row label="Name">{r.name}</Row>
            <Row label="Email">
              <a className="underline" href={`mailto:${r.email}?subject=${encodeURIComponent(`Your Ecram Execs quotation ${r.reference}`)}`}>
                {r.email}
              </a>
            </Row>
            <Row label="Phone">
              <a className="underline" href={`tel:${r.phone.replace(/\s/g, "")}`}>
                {r.phone}
              </a>
              {waNumber.length >= 8 && (
                <a className="ml-3 text-emerald-700 underline" href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
            </Row>
            <Row label="Received">{formatTimestamp(r.createdAt)}</Row>
            <Row label="Quoted amount">{formatEuro(r.quotedAmount)}</Row>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">History</h2>
          <ol className="flex flex-col gap-3 border-l border-zinc-200 pl-4">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="text-zinc-900">{e.message}</span>
                <span className="block text-xs text-zinc-500">
                  {formatTimestamp(e.createdAt)}
                  {e.by ? ` · ${e.by}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-4 sm:p-6 lg:sticky lg:top-6">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-500">Manage</h2>
        <UpdateForm key={r.updatedAt.toISOString()} id={r.id} status={r.status} quotedAmount={r.quotedAmount} internalNotes={r.internalNotes} />
        <div className="mt-6 border-t border-zinc-100 pt-4">
          <DeleteRequest id={r.id} reference={r.reference} />
        </div>
      </aside>
    </div>
  );
}
