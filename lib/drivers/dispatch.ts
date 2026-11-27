import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { heldKeys } from "@/lib/fleet/held";
import { blocksOf, overlaps, wallMinutes, wallText } from "@/lib/fleet/schedule";
import { towsTrailer, vehicleModel } from "@/lib/fleet/vehicles";
import { TRAILER_KEY } from "@/lib/pricing/extras";
import { amsterdamToday, utcToAmsterdamParts } from "@/lib/drivers/time";
import { dispatchBlock, type ComplianceVehicle, type DispatchBlock, type DispatchDriver } from "@/lib/drivers/compliance";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const { drivers: d, driverVehicles: dv, quoteRequests: q, vehicles: v } = schema;

/** The driver columns every compliance check reads; explicit, so no other profile field travels with them. */
export const complianceColumns = {
  id: d.id,
  name: d.name,
  active: d.active,
  driverType: d.driverType,
  accountStatus: d.accountStatus,
  licenceNumber: d.licenceNumber,
  licenceExpiry: d.licenceExpiry,
  catB: d.catB,
  catBeCode96: d.catBeCode96,
  catDCode95: d.catDCode95,
  code95Expiry: d.code95Expiry,
  noPrivateCodes: d.noPrivateCodes,
  kiwaCardNumber: d.kiwaCardNumber,
  kiwaCardType: d.kiwaCardType,
  taxipasExpiry: d.taxipasExpiry,
  cdtCheckedOn: d.cdtCheckedOn,
  vogIssuedOn: d.vogIssuedOn,
  vogVerified: d.vogVerified,
  medicalStatus: d.medicalStatus,
  kvk: d.kvk,
  iban: d.iban,
  permitNumber: d.permitNumber,
  permitExpiry: d.permitExpiry,
  ondernemerskaartNumber: d.ondernemerskaartNumber,
  ondernemerskaartExpiry: d.ondernemerskaartExpiry,
  insurer: d.insurer,
  insurancePolicy: d.insurancePolicy,
  insuranceExpiry: d.insuranceExpiry,
  evInduction: d.evInduction,
  trailerInduction: d.trailerInduction,
  authorisedModels: d.authorisedModels,
};

export const ownVehicleLabel = (car: { make: string; model: string | null; plate: string }) => [[car.make, car.model].filter(Boolean).join(" "), car.plate].join(" · ");

/** Each driver's own cars, keyed by driver id, in the shape the compliance rules read. */
export async function ownVehiclesByDriver(driverIds: string[], tx: Tx | typeof db = db): Promise<Map<string, ComplianceVehicle[]>> {
  const map = new Map<string, ComplianceVehicle[]>();
  if (driverIds.length === 0) return map;
  const rows = await tx.select({ id: dv.id, driverId: dv.driverId, make: dv.make, model: dv.model, plate: dv.plate, apkExpiry: dv.apkExpiry }).from(dv).where(inArray(dv.driverId, driverIds));
  for (const row of rows) map.set(row.driverId, [...(map.get(row.driverId) ?? []), { id: row.id, label: ownVehicleLabel(row), apkExpiry: row.apkExpiry }]);
  return map;
}

/** A registered car's key for authorisation and the rules: its model, else its own id (a car of its own). */
export const carRowKey = (row: { id: string; modelKey?: string | null }) => vehicleModel(row) ?? row.id;

/**
 * The reference of a booking that wants the Debon trailer behind this car's model at some point of the link, or null.
 * Bookings still being discussed count too (new, contacted, quoted), as for a clash. Pick-ups are Amsterdam wall-clock
 * times, so the link is turned into wall-clock minutes first. A model that cannot tow (the Audi) never matches.
 */
export async function trailerBookingDuring(key: string, start: Date, end: Date, tx: Tx | typeof db = db): Promise<string | null> {
  if (!towsTrailer(key)) return null;
  const from = utcToAmsterdamParts(start);
  const to = utcToAmsterdamParts(end);
  const lo = wallMinutes(`${from.date}T${from.time}`);
  const hi = wallMinutes(`${to.date}T${to.time}`);
  if (lo === null || hi === null) return null;
  const link = { start: lo, end: hi };
  // A trip can start up to two days before the link and still be under way
  const earliest = wallText(lo - 2 * 24 * 60);
  const latest = wallText(hi);
  const rows = await tx
    .select({ id: q.id, reference: q.reference, status: q.status, vehicle: q.vehicle, vehicles: q.vehicles, extras: q.extras, service: q.service, pickupAt: q.pickupAt, returnAt: q.returnAt, durationHours: q.durationHours, blockMinutes: q.blockMinutes, driveBackMinutes: q.driveBackMinutes })
    .from(q)
    .where(
      and(
        inArray(q.status, ["new", "contacted", "quoted", "confirmed"]),
        sql`${q.extras} @> ${JSON.stringify([{ key: TRAILER_KEY }])}::jsonb`,
        or(sql`${q.pickupAt} between ${earliest}::timestamp and ${latest}::timestamp`, sql`${q.returnAt} between ${earliest}::timestamp and ${latest}::timestamp`),
      ),
    );
  for (const row of rows) {
    if (!heldKeys(row).has(key)) continue;
    // The trip itself, not the turnaround after it: the trailer is behind the car while the trip runs
    if (blocksOf({ ...row, status: "confirmed" }).some((block) => overlaps({ start: block.start, end: block.tripEnd }, link))) return row.reference;
  }
  return null;
}

/** Why this driver may not be linked to this car for this window, or null. Run inside the link's locked transaction. */
export async function checkDispatch(tx: Tx, driverId: string, vehicleId: string, start: Date, end: Date): Promise<DispatchBlock | "noDriver" | "noCar" | null> {
  const [driver] = await tx.select(complianceColumns).from(d).where(and(eq(d.id, driverId), eq(d.active, true))).limit(1);
  if (!driver) return "noDriver";
  const [car] = await tx.select({ id: v.id, modelKey: v.modelKey, apkExpiry: v.apkExpiry, insuranceExpiry: v.insuranceExpiry }).from(v).where(eq(v.id, vehicleId)).limit(1);
  if (!car) return "noCar";
  const key = carRowKey(car);
  const own = (await ownVehiclesByDriver([driverId], tx)).get(driverId) ?? [];
  return dispatchBlock({
    driver: driver as DispatchDriver,
    ownVehicles: own,
    car: { key, apkExpiry: car.apkExpiry, insuranceExpiry: car.insuranceExpiry },
    today: amsterdamToday(),
    endDate: utcToAmsterdamParts(end).date,
    trailerBooking: await trailerBookingDuring(key, start, end, tx),
  });
}

/** The team's message for a refused link (the admin is in English). */
export function dispatchMessage(block: DispatchBlock | "noDriver" | "noCar", labels: Record<string, string>): string {
  if (block === "noDriver") return "That driver is archived or no longer exists.";
  if (block === "noCar") return "That vehicle no longer exists.";
  switch (block.reason) {
    case "suspended":
      return block.expired.length > 0
        ? `This driver is suspended: expired by the end of this link: ${block.expired.map((k) => labels[k] ?? k).join(", ")}.`
        : "This driver is suspended. Lift the suspension on their profile first.";
    case "pending":
      return `This driver is pending verification. Still needed: ${block.missing.map((k) => labels[k] ?? k).join(", ")}.`;
    case "carApk":
      return "This car's APK has expired by the end of this link.";
    case "carInsurance":
      return "This car's insurance has expired by the end of this link.";
    case "eSprinter":
      return "Only drivers with D1 / D and Code 95 can drive the 16-seat eSprinter.";
    case "code95Expired":
      return "This driver's Code 95 has expired (or has no date) by the end of this link: the eSprinter needs a valid Code 95.";
    case "trailer":
      return `Booking ${block.reference} tows the Debon C255 trailer behind this model at that time: only drivers with BE / Code 96 can be linked.`;
    case "notAuthorised":
      return "This agency driver is not authorised for this car. Tick it under Authorised company vehicles on their profile.";
    case "induction":
      return block.which === "ev" ? "This agency driver has not had the EV induction yet." : "This agency driver has not had the trailer induction yet.";
  }
}

/**
 * Drivers linked, at the booking's pick-up, to one of the cars of a booking that tows the trailer, who have no BE / Code 96.
 * The link was checked when it was made, but a trailer booking can be confirmed afterwards: the booking page shows these.
 */
export async function trailerLicenceGaps(booking: { vehicle: string | null; vehicles?: unknown; extras?: unknown; pickupAt: string | null }, at: Date | null): Promise<string[]> {
  const keys = heldKeys(booking);
  if (!at || !keys.has(TRAILER_KEY)) return [];
  const { driverAssignments: a } = schema;
  const rows = await db
    .select({ name: d.name, catBeCode96: d.catBeCode96, vehicleId: v.id, modelKey: v.modelKey })
    .from(a)
    .innerJoin(d, eq(d.id, a.driverId))
    .innerJoin(v, eq(v.id, a.vehicleId))
    .where(and(sql`${a.startTime} <= ${at.toISOString()}::timestamptz`, sql`${a.endTime} >= ${at.toISOString()}::timestamptz`));
  return [...new Set(rows.filter((row) => !row.catBeCode96 && keys.has(carRowKey({ id: row.vehicleId, modelKey: row.modelKey }))).map((row) => row.name))];
}
