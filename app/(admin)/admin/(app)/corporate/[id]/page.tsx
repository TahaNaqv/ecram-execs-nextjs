export const instant = false;
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { PartnerProfileClient } from "./partner-profile-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  const name = detail?.partner.companyName ?? "Corporate Partner";
  return { title: `Partner Profile: ${name}` };
}

export default async function CorporatePartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);

  if (!detail) {
    notFound();
  }

  const { partner: p, contact, bookings, totalSpend } = detail;
  const totalTrips = bookings.length;
  const avgTripValue = totalTrips > 0 ? Math.round(totalSpend / totalTrips) : 0;
  const tier = totalSpend > 40000 ? "Platinum" : totalSpend > 15000 ? "Gold" : "Silver";
  const discountRate = tier === "Platinum" ? "15%" : tier === "Gold" ? "10%" : "5%";

  const mappedPartner = {
    id: p.id,
    name: p.companyName,
    companyName: p.companyName,
    kvkNumber: p.kvk,
    kvrNumber: contact.kvkNumber || "—",
    bookerName: p.bookerName,
    bookerPosition: p.bookerRole,
    bookerEmail: p.email,
    bookerPhone: p.phone,
    tier: tier as "Platinum" | "Gold" | "Silver",
    discountRate,
    status: p.status,
    totalTrips,
    avgTripValue,
    totalSpend,
    topVehicle: p.preferredVehicle,
    recentBookings: bookings.slice(0, 10).map((b) => ({
      id: b.id,
      reference: b.reference,
      passengerName: b.passengerName || b.name,
      route:
        b.collection && b.destination
          ? `${b.collection} → ${b.destination}`
          : b.collection || "Amsterdam VIP Service",
      vehicle: b.vehicle || "Mercedes-EQS",
      pickupDate: b.pickupAt ? new Date(b.pickupAt).toLocaleDateString() : "—",
      amount: Number(b.quotedAmount ?? 0),
      status: b.status,
    })),
    initialNotes: [],
  };

  return <PartnerProfileClient partner={mappedPartner} />;
}