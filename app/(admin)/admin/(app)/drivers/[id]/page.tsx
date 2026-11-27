export const instant = false;
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { driverCompliance } from "@/lib/drivers/compliance";
import { ownVehicleLabel } from "@/lib/drivers/dispatch";
import { maySeePrivate, type DriverDocumentKind } from "@/lib/drivers/documents";
import { amsterdamToday } from "@/lib/drivers/time";
import { FLEET, vehicleModel } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { signedDownloadUrl, storageConfigured } from "@/lib/storage";
import { DriverProfile, type ProfileDocument } from "./profile-client";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.driverProfile.title };
}

export default async function DriverProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireArea("/admin/drivers");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [[row], documents, ownCars, cars, [application], { admin: dict }] = await Promise.all([
    db.select().from(schema.drivers).where(eq(schema.drivers.id, id)).limit(1),
    db.select().from(schema.driverDocuments).where(eq(schema.driverDocuments.driverId, id)),
    db.select().from(schema.driverVehicles).where(eq(schema.driverVehicles.driverId, id)).orderBy(asc(schema.driverVehicles.createdAt)),
    db.select({ id: schema.vehicles.id, name: schema.vehicles.name, plate: schema.vehicles.licensePlate, modelKey: schema.vehicles.modelKey }).from(schema.vehicles).orderBy(asc(schema.vehicles.name)),
    db.select({ id: schema.driverApplications.id }).from(schema.driverApplications).where(eq(schema.driverApplications.driverId, id)).limit(1),
    adminDictionary(),
  ]);
  if (!row) notFound();

  const today = amsterdamToday();
  const own = ownCars.map((car) => ({ id: car.id, label: ownVehicleLabel(car), apkExpiry: car.apkExpiry }));
  const compliance = driverCompliance(row, own, today);
  const privateOk = maySeePrivate(admin);

  // Links last ten minutes; the photo opens as a picture, every scan as a download
  const signed: Partial<Record<DriverDocumentKind, ProfileDocument>> = {};
  if (storageConfigured()) {
    await Promise.all(
      documents.map(async (doc) => {
        const url = await signedDownloadUrl(doc.path).catch(() => null);
        const inline = doc.kind === "photo" && url?.startsWith("/api/documents/file") ? `${url}&inline=1` : url;
        signed[doc.kind as DriverDocumentKind] = { id: doc.id, fileName: doc.fileName, url: inline };
      }),
    );
  }

  // What an agency driver can be authorised for: the printed models, then any registered car of its own
  const ownCarsOfFleet = cars.filter((car) => !vehicleModel(car));
  const authorisable = [
    ...FLEET.map((model) => ({ key: model.key, label: model.name })),
    ...ownCarsOfFleet.map((car) => ({ key: car.id, label: [car.name, car.plate].filter(Boolean).join(" · ") })),
  ];

  const { address, dateOfBirth, iban, ...rest } = row;
  return (
    <DriverProfile
      driver={{
        ...rest,
        address: privateOk ? address : null,
        dateOfBirth: privateOk ? dateOfBirth : null,
        iban: privateOk ? iban : iban ? `•••• ${iban.slice(-4)}` : null,
      }}
      compliance={compliance}
      documents={signed}
      vehicles={ownCars.map((car) => ({ id: car.id, make: car.make, model: car.model, colour: car.colour, plate: car.plate, passengers: car.passengers, luggage: car.luggage, apkExpiry: car.apkExpiry }))}
      authorisable={authorisable}
      applicationId={application?.id ?? null}
      privateOk={privateOk}
      canErase={admin.role === "owner"}
      storage={storageConfigured()}
      copy={dict.driverProfile}
      locale={admin.locale === "nl" ? "nl-NL" : "en-GB"}
    />
  );
}
