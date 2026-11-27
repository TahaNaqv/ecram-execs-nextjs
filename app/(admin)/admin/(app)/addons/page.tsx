import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { STOCKED_EXTRA_KEYS } from "@/lib/pricing/extras";
import { Card, PageBody, PageHeader, Skeleton } from "../../_components/ui";
import { addonLabel, LOW_STOCK } from "./addon-rules";
import { StockCard, SuppliersCard, type StockRow, type SupplierRow } from "./addons-manager";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.addons ?? "Add-ons"} — Ecram Execs` };
}

export default function AddonsPage() {
  return (
    <Suspense
      fallback={
        <PageBody>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true">
            <Card><div className="flex flex-col gap-3 p-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></Card>
            <Card><div className="flex flex-col gap-3 p-5"><Skeleton className="h-5 w-32" /><Skeleton className="h-16 w-full" /></div></Card>
          </div>
        </PageBody>
      }
    >
      <Addons />
    </Suspense>
  );
}

async function Addons() {
  await requireAdmin();
  const [stock, suppliers] = await Promise.all([
    db.select().from(schema.addonStock),
    db.select().from(schema.addonSuppliers).orderBy(asc(schema.addonSuppliers.name)),
  ]);
  const byKey = new Map(stock.map((row) => [row.key, row]));
  const rows: StockRow[] = STOCKED_EXTRA_KEYS.map((key) => {
    const row = byKey.get(key);
    return { key, label: addonLabel(key), onHand: row?.onHand ?? 0, supplierId: row?.supplierId ?? null };
  });
  const supplierRows: SupplierRow[] = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    notes: supplier.notes,
    linked: rows.filter((row) => row.supplierId === supplier.id).map((row) => row.label),
  }));
  const low = rows.filter((row) => row.onHand < LOW_STOCK).length;
  return (
    <PageBody>
      <PageHeader
        title="Add-ons"
        description={low > 0 ? `${low} of ${rows.length} add-ons are running low.` : "Stock and suppliers for the in-car add-ons."}
      />
      <StockCard rows={rows} suppliers={supplierRows} />
      <SuppliersCard suppliers={supplierRows} addons={rows.map(({ key, label }) => ({ key, label }))} />
    </PageBody>
  );
}
