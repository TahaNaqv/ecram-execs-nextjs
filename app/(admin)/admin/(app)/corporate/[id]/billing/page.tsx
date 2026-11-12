export const instant = false;
import { notFound } from "next/navigation";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { PartnerBillingClient } from "./partner-billing-client";
import { BillingAddressCard } from "./billing-address-card";
import { billingDetails } from "@/lib/corporate/billing";

export default async function PartnerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  if (!detail) notFound();

  const { partner, contact, bookings, totalSpend } = detail;
  
  const [{ admin }, billing] = await Promise.all([adminDictionary(), billingDetails(id)]);
  return (
    <>
    <PartnerBillingClient
      partnerId={partner.id}
      companyName={partner.companyName}
      kvkNumber={partner.kvk}
      kvrNumber={contact.kvkNumber || "—"}
      totalSpend={totalSpend}
      bookings={bookings}
      copy={admin.corporate.hub}
    />
    {billing && (
      <div className="mx-auto max-w-7xl px-6 pb-8 lg:px-8">
        <BillingAddressCard partnerId={id} initial={billing} copy={admin.moneybird} />
      </div>
    )}
    </>
  );
}