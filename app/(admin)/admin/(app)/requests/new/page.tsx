import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { FLEET } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import { asc, isNotNull } from "drizzle-orm";
import { ArrowLeftIcon } from "../../../_components/icons";
import { Card, PageBody, PageHeader, Skeleton } from "../../../_components/ui";
import { NewBookingForm } from "./new-booking-form";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.newBooking.title };
}

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.newBooking[part];
}

async function Back() {
  const { admin } = await adminDictionary();
  return admin.common.backToRequests;
}

async function Form() {
  const sessionAdmin = await requireAdmin();
  const [d, partners, dbVehicles] = await Promise.all([
    adminDictionary(),
    db
      .select({ id: schema.corporateContacts.id, name: schema.corporateContacts.name, companyName: schema.corporateContacts.companyName, email: schema.corporateContacts.email })
      .from(schema.corporateContacts)
      .where(isNotNull(schema.corporateContacts.passwordSetAt))
      .orderBy(asc(schema.corporateContacts.name))
      .limit(500),
    db.select().from(schema.vehicles).catch(() => []),
  ]);
  const t = d.admin.newBooking;
  const vehicleOptions =
    dbVehicles && dbVehicles.length > 0
      ? dbVehicles.map((v) => ({
          value: v.id,
          label: `${v.name}${v.status === "unavailable" ? " (Unavailable)" : ""}`,
        }))
      : FLEET.map((v) => ({ value: v.key, label: v.name }));
  
  const isDutch = sessionAdmin.locale === "nl" || "tussenstop" in (d.admin.newBooking as Record<string, unknown>);

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <NewBookingForm
        partners={partners.map((p) => ({ value: p.id, label: `${p.name}${p.companyName ? ` — ${p.companyName}` : ""} (${p.email})` }))}
        services={(["airport_transfer", "business_travel", "hourly", "private_occasion"] as const).map((s) => ({ value: s, label: d.services[s] }))}
        statuses={REQUEST_STATUSES.map((s) => ({ value: s, label: d.admin.statuses[s] }))}
        vehicles={vehicleOptions}
        copy={{
          ...t,
          addStop: isDutch ? "Tussenstop toevoegen" : "Add stop",
        }}
        locale={sessionAdmin.locale}
        dateTimeCopy={d.dateTimePicker}
      />
    </Card>
  );
}

export default function NewBookingPage() {
  const bar = <span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />;
  return (
    <PageBody>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
        <ArrowLeftIcon size={14} />
        <Suspense fallback={bar}>
          <Back />
        </Suspense>
      </Link>
      <PageHeader
        title={
          <Suspense fallback={bar}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={bar}>
            <Heading part="description" />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-xl" />}>
        <Form />
      </Suspense>
    </PageBody>
  );
}