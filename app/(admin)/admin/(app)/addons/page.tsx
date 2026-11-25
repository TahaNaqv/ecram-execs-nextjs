import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { EXTRA_KEYS } from "@/lib/pricing/extras";
import { btn, Card, PageBody, PageHeader, field } from "../../_components/ui";
import { addSupplier, deleteSupplier, saveAddonStock } from "./actions";
import { PendingSubmit } from "./pending-submit";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.addons ?? "Add-ons"} — Ecram Execs` };
}

export default function AddonsPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <Addons />
    </Suspense>
  );
}

async function Addons() {
  await requireAdmin();
  const [stock, suppliers] = await Promise.all([db.select().from(schema.addonStock), db.select().from(schema.addonSuppliers)]);
  const byKey = new Map(stock.map((row) => [row.key, row]));
  return (
    <PageBody>
      <PageHeader title="Add-ons" />
      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-[12px] tracking-wide text-zinc-500 uppercase">
              <th className="px-5 py-2 font-medium">Add-on</th>
              <th className="px-5 py-2 font-medium">On hand</th>
              <th className="px-5 py-2 font-medium">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {EXTRA_KEYS.map((key) => {
              const row = byKey.get(key);
              const supplier = suppliers.find((item) => item.id === row?.supplierId);
              return (
                <tr key={key} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 font-medium capitalize text-zinc-950">{key}{(row?.onHand ?? 0) < 5 ? <span className="ml-2 text-[12px] text-red-700">Low</span> : null}</td>
                  <td className="px-5 py-3">
                    <form action={saveAddonStock} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="key" value={key} />
                      <input name="onHand" type="number" min={0} defaultValue={row?.onHand ?? 0} className={`${field} h-9 w-24`} />
                      <select name="supplierId" defaultValue={row?.supplierId ?? ""} className={`${field} h-9 max-w-56`}>
                        <option value="">No supplier</option>
                        {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <button className={`${btn.base} ${btn.secondary} ${btn.sm}`}>Save</button>
                    </form>
                  </td>
                  <td className="px-5 py-3 text-zinc-700">{supplier ? `${supplier.name}${supplier.email ? ` · ${supplier.email}` : ""}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4">
        <form action={addSupplier} className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <label className="text-[13px] text-zinc-700">Supplier name<input name="name" required className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">Email<input name="email" type="email" className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">Phone<input name="phone" className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">Linked add-on
            <select name="key" className={`${field} mt-1 h-10`}>
              {EXTRA_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </label>
          <label className="text-[13px] text-zinc-700 md:col-span-2">Notes<textarea name="notes" rows={2} className={`${field} mt-1`} /></label>
          <PendingSubmit label="Save supplier" pendingLabel="Saving supplier…" className={`${btn.base} ${btn.primary} ${btn.md} self-start disabled:cursor-progress disabled:opacity-70`} />
        </form>
        {suppliers.length > 0 && (
          <ul className="m-0 list-none border-t border-zinc-100">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
                <div className="min-w-0 text-sm text-zinc-800">
                  <p className="m-0 font-medium text-zinc-950">{supplier.name}</p>
                  <p className="m-0 text-[13px] text-zinc-500">{[supplier.email, supplier.phone, supplier.notes].filter(Boolean).join(" · ") || "No contact details"}</p>
                </div>
                <form action={deleteSupplier}>
                  <input type="hidden" name="id" value={supplier.id} />
                  <button className={`${btn.base} ${btn.danger} ${btn.sm}`}>Remove supplier</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageBody>
  );
}
