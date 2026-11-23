export const instant = false;

import type { Metadata } from "next";
import { Suspense } from "react";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { PageBody, PageHeader, Skeleton } from "../../../_components/ui";
import { EvFinancialsSection } from "../ev-financials-section";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.vehicles.ev.title };
}

async function Heading({ part }: { part: "title" | "note" }) {
  const { admin } = await adminDictionary();
  return admin.vehicles.ev[part];
}

export default function VehicleCostsPage() {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-48 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-96 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="note" />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="mt-6 h-80" />}>
        <EvFinancialsSection />
      </Suspense>
    </PageBody>
  );
}
