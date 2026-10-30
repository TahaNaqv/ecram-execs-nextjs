export const instant = false;
import { notFound } from "next/navigation";
import { formatPickup } from "@/lib/admin/format";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { PartnerBookingsClient } from "./partner-bookings-client";

export default async function PartnerBookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  if (!detail) notFound();

  const { partner, bookings } = detail;
  const { admin } = await adminDictionary();
  const detailCopy = admin.requestDetail;
  const mappedBookings = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    passengerName: b.passengerName || b.name,
    route: b.collection && b.destination ? `${b.collection} → ${b.destination}` : b.collection || "—",
    vehicle: b.vehicle ? (vehicleByKey(b.vehicle)?.name ?? b.vehicle) : "—",
    pickupDate: [
      b.pickupAt ? formatPickup(b.pickupAt) : "—",
      b.passengers != null ? `${b.passengers} ${detailCopy.passengers}` : null,
      b.luggage != null ? `${b.luggage} ${detailCopy.luggage}` : null,
    ]
      .filter((part) => part != null)
      .join(" · "),
    amount: Number(b.quotedAmount ?? 0),
    status: b.status,
  }));
  return <PartnerBookingsClient partnerId={partner.id} companyName={partner.companyName} bookings={mappedBookings} copy={admin.corporate.hub} />;
}