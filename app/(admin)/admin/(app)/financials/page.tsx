export const instant = false;
import { Suspense } from "react";
import { PageBody, PageHeader } from "../../_components/ui";
import { FinancialAutomationEngine } from "./financial-engine";
import { getFinancialSummary, getDriverPayoutRows } from "@/lib/admin/live-queries";


async function FinancialsContent() {
  const [summary, drivers] = await Promise.all([
    getFinancialSummary(),
    getDriverPayoutRows(),
  ]);
  return <FinancialAutomationEngine summary={summary} drivers={drivers} />;
}

export default function FinancialsPage() {
  return (
    <PageBody>
      <PageHeader
        title="Financial Automation & Bookkeeper Export Engine"
        description="Exact Online & Moneybird synchronization · Dutch VAT splits (21%, 9%, 0%) · Agency & ZZP driver payouts · SEPA PAIN.001 XML Export"
      />
      <div className="mt-6">
        <Suspense fallback={<div className="animate-pulse h-96 bg-zinc-100 rounded-xl" />}>
          <FinancialsContent />
        </Suspense>
      </div>
    </PageBody>
  );
}
