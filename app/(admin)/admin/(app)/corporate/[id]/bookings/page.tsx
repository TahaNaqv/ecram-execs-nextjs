export const instant = false;
import { notFound } from "next/navigation";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { PartnerBookingsClient } from "./partner-bookings-client";

export default async function PartnerBookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  if (!detail) notFound();

  const { partner, bookings } = detail;
  const mappedBookings = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    passengerName: b.passengerName || b.name,
    route: b.collection && b.destination ? `${b.collection} → ${b.destination}` : b.collection || "Amsterdam VIP Service",
    vehicle: b.vehicle || "Mercedes-EQS",
    pickupDate: b.pickupAt ? new Date(b.pickupAt).toLocaleDateString() : "—",
    amount: Number(b.quotedAmount ?? 0),
    status: b.status,
  }));

  return <PartnerBookingsClient partnerId={partner.id} companyName={partner.companyName} bookings={mappedBookings} />;
}