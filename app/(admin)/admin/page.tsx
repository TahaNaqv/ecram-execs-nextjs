import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatPickup, formatTimestamp, STATUS_LABEL } from "@/lib/admin/format";
import { listRequests, PAGE_SIZE, statusCounts } from "@/lib/admin/queries";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import { AdminHeader, AdminHeaderFallback } from "./_components/admin-header";
import { StatusBadge } from "./_components/status-badge";

export const metadata: Metadata = { title: "Quote requests" };

type Search = { status?: string; q?: string; page?: string };

export default function RequestsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<AdminHeaderFallback />}>
        <AdminHeader />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Quote requests</h1>
        <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading requests…</p>}>
          <Requests searchParams={searchParams as Promise<Search>} />
        </Suspense>
      </main>
    </>
  );
}

function href(params: Search) {
  const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = sp.toString();
  return s ? `/admin?${s}` : "/admin";
}

async function Requests({ searchParams }: { searchParams: Promise<Search> }) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ rows, total }, counts] = await Promise.all([
    listRequests({ status, search: q?.trim(), page }),
    statusCounts(),
  ]);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabs = [{ key: "", label: "All", n: all }, ...REQUEST_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], n: counts[s] }))];

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter by status">
          {tabs.map((t) => {
            const active = (status ?? "") === t.key;
            return (
              <Link
                key={t.key || "all"}
                href={href({ status: t.key, q })}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-200"}`}
              >
                {t.label} <span className="text-zinc-400">{t.n}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/admin" className="flex w-full gap-2 lg:w-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, ref, place…"
            className="min-w-0 flex-1 rounded border lg:w-64 lg:flex-none border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <button className="rounded bg-zinc-950 px-4 py-2 text-sm text-white hover:bg-zinc-800">Search</button>
        </form>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/requests/${r.id}`} className="block h-full rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 active:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate ${r.status === "new" ? "font-semibold" : "font-medium"}`}>{r.name}</p>
                  <p className="truncate text-xs text-zinc-500">{r.email}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-3 text-sm text-zinc-700">
                {r.collection} → {r.destination}
              </p>
              <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>
                  {formatPickup(r.pickupAt)} · {r.service}
                </span>
                <span className="font-mono">{r.reference}</span>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500 sm:col-span-2">
            {q || status ? "No requests match these filters." : "No quote requests yet."}
          </li>
        )}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Journey</th>
              <th className="px-4 py-3 font-medium">Pick-up (NL)</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-zinc-50 ${r.status === "new" ? "font-medium" : ""}`}>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  <Link href={`/admin/requests/${r.id}`} className="block">
                    {formatTimestamp(r.createdAt)}
                    <span className="block font-mono text-xs text-zinc-400">{r.reference}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/requests/${r.id}`} className="block hover:underline">
                    {r.name}
                    <span className="block text-xs font-normal text-zinc-500">{r.email}</span>
                  </Link>
                </td>
                <td className="max-w-[260px] px-4 py-3 text-zinc-700">
                  <span className="line-clamp-2">
                    {r.collection} → {r.destination}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{formatPickup(r.pickupAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{r.service}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-zinc-500">
                  {q || status ? "No requests match these filters." : "No quote requests yet. They will appear here as soon as one is submitted."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
          <span>
            Page {page} of {pages} · {total} requests
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100" href={href({ status, q, page: String(page - 1) })}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100" href={href({ status, q, page: String(page + 1) })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
