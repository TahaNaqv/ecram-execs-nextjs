export const instant = false;
import { notFound } from "next/navigation";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { PartnerBillingClient } from "./partner-billing-client";

export default async function PartnerBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  if (!detail) notFound();

  const { partner, contact, bookings, totalSpend } = detail;
  
  return (
    <PartnerBillingClient
      partnerId={partner.id}
      companyName={partner.companyName}
      kvkNumber={partner.kvk}
      kvrNumber={contact.kvkNumber || "—"}
      totalSpend={totalSpend}
      bookings={bookings}
    />
  );
}