import type { Metadata } from "next";
import { Suspense } from "react";
import { corporateTotals, listCorporateContacts } from "@/lib/admin/corporate";
import { formatRelative, formatTimestamp } from "@/lib/admin/format";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { BriefcaseIcon } from "../../_components/icons";
import { Avatar, Card, EmptyState, PageBody, PageHeader, Skeleton } from "../../_components/ui";
import { ExportButtons } from "./export-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.corporate.title };
}

async function Heading() {
  const { admin } = await adminDictionary();
  return admin.corporate.title;
}

async function Description() {
  const { admin } = await adminDictionary();
  return admin.corporate.description;
}
export const instant = false;
export default function CorporatePage() {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-28 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Description />
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <Contacts />
      </Suspense>
    </PageBody>
  );
}

async function Contacts() {
  const [rows, totals, dict] = await Promise.all([listCorporateContacts(), corporateTotals(), adminDictionary()]);
  const t = dict.admin.corporate;

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4 sm:px-5">
        <p className="m-0 text-sm text-zinc-600">
          {t.totals.replace("{total}", String(totals.total)).replace("{optedIn}", String(totals.optedIn))}
        </p>
        <ExportButtons
          all={{ href: "/admin/corporate/export", label: t.exportAll }}
          optedIn={{ href: "/admin/corporate/export?consent=1", label: t.exportOptedIn }}
          notice={t.exportStarted}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<BriefcaseIcon size={18} />} title={t.emptyAll} description={t.emptyNote} />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 px-4 py-4 sm:items-center sm:px-5">
              <Avatar name={r.name} />
              <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-950">{r.name}</p>
                  <p className="truncate text-xs text-zinc-500">{r.position}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-800">{r.companyName ?? r.emailDomain}</p>
                  <a href={`mailto:${r.email}`} className="truncate text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950">
                    {r.email}
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.verifiedAt ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                    {r.verifiedAt ? t.verified : t.notVerified}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.passwordSetAt ? "bg-sky-50 text-sky-700" : "bg-zinc-100 text-zinc-500"}`}
                    title={r.lastLoginAt ? formatTimestamp(r.lastLoginAt) : undefined}>
                    {r.passwordSetAt ? t.hasAccount : t.noAccount}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.marketingConsent ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                    {r.marketingConsent ? t.optedIn : t.noConsent}
                  </span>
                  <span className="text-xs text-zinc-500 sm:w-20 sm:text-right" title={formatTimestamp(r.createdAt)}>
                    {formatRelative(r.createdAt)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ListSkeleton() {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
