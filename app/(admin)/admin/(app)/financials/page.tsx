export const instant = false;
import { Suspense } from "react";
import { PageBody, PageHeader } from "../../_components/ui";
import { FinancialAutomationEngine } from "./financial-engine";
import { getFinancialSummary, getDriverPayoutRows } from "@/lib/admin/live-queries";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.financials[part];
}

async function FinancialsContent() {
  const { admin } = await adminDictionary();
  const [summary, drivers] = await Promise.all([
    getFinancialSummary(),
    getDriverPayoutRows(),
  ]);
  return <FinancialAutomationEngine summary={summary} drivers={drivers} copy={admin.financials} />;
}

export default function FinancialsPage() {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-64 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-96 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="description" />
          </Suspense>
        }
      />
      <div className="mt-6">
        <Suspense fallback={<div className="animate-pulse h-96 bg-zinc-100 rounded-xl" />}>
          <FinancialsContent />
        </Suspense>
      </div>
    </PageBody>
  );
}
