import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { introducerBoard } from "@/lib/admin/introducers";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatCurrency } from "@/lib/pricing/rates";
import { btn, Card, PageBody, PageHeader, field } from "../../_components/ui";
import { addIntroducer, deleteIntroducer, emailIntroducer, updateIntroducer } from "./actions";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.introducers ?? "Introducers"} — Ecram Execs` };
}

export default function IntroducersPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <Introducers />
    </Suspense>
  );
}

async function Introducers() {
  await requireAdmin();
  const rows = await introducerBoard();
  return (
    <PageBody>
      <PageHeader title="Introducers" />
      <Card className="mt-6 overflow-hidden">
        <form action={addIntroducer} className="flex flex-wrap items-end gap-3 border-b border-zinc-100 px-5 py-4">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-[13px] text-zinc-700">
            Name
            <input name="name" required className={`${field} h-10`} />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-[13px] text-zinc-700">
            Email
            <input name="email" type="email" className={`${field} h-10`} />
          </label>
          <label className="flex w-28 flex-col gap-1 text-[13px] text-zinc-700">
            Percent
            <input name="percent" type="number" min={0} max={100} defaultValue={10} className={`${field} h-10`} />
          </label>
          <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Add introducer</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-[12px] tracking-wide text-zinc-500 uppercase">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Corporate partners</th>
                <th className="px-5 py-2 font-medium">This month</th>
                <th className="px-5 py-2 font-medium">Commission</th>
                <th className="px-5 py-2 font-medium">Notify</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3">
                    <form id={`introducer-${row.id}`} action={updateIntroducer} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <input name="name" required defaultValue={row.name} aria-label="Name" className={`${field} h-9`} />
                      <input name="email" type="email" defaultValue={row.email ?? ""} aria-label="Email" placeholder="Email" className={`${field} h-9`} />
                      <label className="flex items-center gap-2 text-[13px] text-zinc-700">
                        <input type="checkbox" name="active" defaultChecked={row.active} />
                        Active
                      </label>
                    </form>
                  </td>
                  <td className="px-5 py-3">
                    {row.partners.length === 0 ? <span className="text-zinc-400">None yet</span> : row.partners.map((partner) => (
                      <Link key={partner.id} href={`/admin/corporate/${partner.id}`} className="mr-2 text-zinc-950 underline underline-offset-2">{partner.name}</Link>
                    ))}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatCurrency(row.monthNetCents / 100)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <input form={`introducer-${row.id}`} name="percent" type="number" min={0} max={100} defaultValue={row.commissionPercent} aria-label="Percent" className={`${field} h-9 w-20`} />
                      <span className="text-zinc-600 tabular-nums">{formatCurrency(row.monthCommissionCents / 100)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button form={`introducer-${row.id}`} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>Save</button>
                      <form action={deleteIntroducer}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className={`${btn.base} ${btn.danger} ${btn.sm}`}>Remove</button>
                      </form>
                    </div>
                    <form action={emailIntroducer} className="mt-2">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="cents" value={row.monthCommissionCents} />
                      <button className={`${btn.base} ${btn.secondary} ${btn.sm}`} disabled={!row.email}>Email invoice request</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageBody>
  );
}
