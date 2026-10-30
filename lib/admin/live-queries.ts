import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { db, schema } from "@/lib/db";

const { vehicles: v, quoteRequests: q, drivers: d, requestEvents: ev, adminUsers, corporateContacts: c } = schema;

// --- Dispatch ---
export type DispatchVehicleRow = {
  id: string;
  name: string;
  plate: string | null;
  color: string | null;
  batterySoC: number;
  rangeKm: number;
  status: string;
  iltPermitStatus: string;
};

export const getDispatchVehicles = cache(async (): Promise<DispatchVehicleRow[]> => {
  await requireAdmin();
  return db
    .select({
      id: v.id,
      name: v.name,
      plate: v.licensePlate,
      color: v.color,
      batterySoC: v.batterySoC,
      rangeKm: v.evRangeKm,
      status: v.status,
      iltPermitStatus: v.iltPermitStatus,
    })
    .from(v)
    .orderBy(asc(v.name));
});

export type DispatchTripRow = {
  id: string;
  reference: string;
  clientName: string;
  entity: string | null;
  vehicleId: string | null;
  service: string;
  pickupAt: string | null;
  durationHours: number | null;
  collection: string | null;
  destination: string | null;
  flightNumber: string | null;
  returnAt: string | null;
  status: string;
};

export const getDispatchTrips = cache(async (): Promise<DispatchTripRow[]> => {
  await requireAdmin();
  return db
    .select({
      id: q.id,
      reference: q.reference,
      clientName: q.name,
      entity: q.entity,
      vehicleId: q.vehicle,
      service: q.service,
      pickupAt: q.pickupAt,
      durationHours: q.durationHours,
      collection: q.collection,
      destination: q.destination,
      flightNumber: q.flightNumber,
      returnAt: q.returnAt,
      status: q.status,
    })
    .from(q)
    .where(
      and(
        eq(q.status, "confirmed"),
        isNotNull(q.pickupAt),
        sql`GREATEST(${q.pickupAt}::timestamp, COALESCE(${q.returnAt}::timestamp, ${q.pickupAt}::timestamp)) >= (NOW() AT TIME ZONE 'Europe/Amsterdam') - INTERVAL '1 day'`
      )
    )
    .orderBy(asc(q.pickupAt))
    .limit(50);
});

// --- Financials ---
export type FinancialSummary = {
  totalRevenue9pct: number;
  totalRevenue21pct: number;
  totalRevenue0pct: number;
  confirmedCount: number;
  completedCount: number;
};

export const getFinancialSummary = cache(async (): Promise<FinancialSummary> => {
  await requireAdmin();
  const [row] = await db
    .select({
      r9: sql<number>`coalesce(sum(${q.quotedAmount}) filter (where ${q.service}::text in ('point_to_point','airport')), 0)`,
      r21: sql<number>`coalesce(sum(${q.quotedAmount}) filter (where ${q.service}::text in ('hourly','bespoke')), 0)`,
      r0: sql<number>`coalesce(sum(${q.quotedAmount}) filter (where ${q.service}::text = 'international'), 0)`,
      confirmed: sql<number>`count(*) filter (where ${q.status} = 'confirmed')`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${q.status} = 'completed')`.mapWith(Number),
    })
    .from(q);

  return {
    totalRevenue9pct: Number(row?.r9 ?? 0),
    totalRevenue21pct: Number(row?.r21 ?? 0),
    totalRevenue0pct: Number(row?.r0 ?? 0),
    confirmedCount: Number(row?.confirmed ?? 0),
    completedCount: Number(row?.completed ?? 0),
  };
});

export type DriverPayoutRow = {
  id: string;
  name: string;
  phone: string | null;
  partner: boolean;
  vehicle: string | null;
  active: boolean;
  taxipasExpiry: string | null;
  vogExpiry: string | null;
};

export const getDriverPayoutRows = cache(async (): Promise<DriverPayoutRow[]> => {
  await requireAdmin();
  return db
    .select({
      id: d.id,
      name: d.name,
      phone: d.phone,
      partner: d.partner,
      vehicle: d.vehicle,
      active: d.active,
      taxipasExpiry: d.taxipasExpiry,
      vogExpiry: d.vogExpiry,
    })
    .from(d)
    .where(eq(d.active, true))
    .orderBy(asc(d.name));
});

// --- Audit ---
export type AuditEventRow = {
  id: string;
  requestId: string;
  event: string;
  params: Record<string, unknown> | null;
  createdAt: Date;
  adminName: string | null;
  requestRef: string | null;
};

export const getRecentAuditEvents = cache(async (limit = 50): Promise<AuditEventRow[]> => {
  await requireAdmin();
  return db
    .select({
      id: ev.id,
      requestId: ev.requestId,
      event: ev.event,
      params: ev.params,
      createdAt: ev.createdAt,
      adminName: adminUsers.name,
      requestRef: q.reference,
    })
    .from(ev)
    .leftJoin(adminUsers, eq(adminUsers.id, ev.adminId))
    .leftJoin(q, eq(q.id, ev.requestId))
    .orderBy(desc(ev.createdAt))
    .limit(limit) as unknown as Promise<AuditEventRow[]>;
});

// --- System counts ---
export type SystemCountsRow = {
  totalVehicles: number;
  availableVehicles: number;
  activeDrivers: number;
  totalRequests: number;
  openRequests: number;
};

export const getSystemCounts = cache(async (): Promise<SystemCountsRow> => {
  await requireAdmin();
  const [[vRow], [dRow], [qRow]] = await Promise.all([
    db
      .select({
        total: count(),
        available: sql<number>`count(*) filter (where ${v.status} = 'available')`.mapWith(Number),
      })
      .from(v),
    db.select({ active: count() }).from(d).where(eq(d.active, true)),
    db
      .select({
        total: count(),
        open: sql<number>`count(*) filter (where ${q.status} in ('new','contacted','quoted'))`.mapWith(Number),
      })
      .from(q),
  ]);

  return {
    totalVehicles: vRow?.total ?? 0,
    availableVehicles: vRow?.available ?? 0,
    activeDrivers: dRow?.active ?? 0,
    totalRequests: qRow?.total ?? 0,
    openRequests: qRow?.open ?? 0,
  };
});

// --- Full vehicle list ---
export type VehicleRow = {
  id: string;
  name: string;
  vin: string | null;
  licensePlate: string | null;
  color: string | null;
  evRangeKm: number;
  batterySoC: number;
  status: string;
  apkExpiry: string | null;
  insuranceExpiry: string | null;
  iltPermitStatus: string;
  updatedAt: Date;
};

/** Drizzle `date` columns are calendar days (`YYYY-MM-DD`). Keep that shape for the fleet table. */
function asCalendarDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

export const getAllVehicles = cache(async (): Promise<VehicleRow[]> => {
  await requireAdmin();
  const rows = await db
    .select({
      id: v.id,
      name: v.name,
      vin: v.vin,
      licensePlate: v.licensePlate,
      color: v.color,
      evRangeKm: v.evRangeKm,
      batterySoC: v.batterySoC,
      status: v.status,
      apkExpiry: v.apkExpiry,
      insuranceExpiry: v.insuranceExpiry,
      iltPermitStatus: v.iltPermitStatus,
      updatedAt: v.updatedAt,
    })
    .from(v)
    .orderBy(asc(v.name));

  return rows.map((row) => ({
    ...row,
    apkExpiry: asCalendarDate(row.apkExpiry),
    insuranceExpiry: asCalendarDate(row.insuranceExpiry),
  }));
});

// --- Corporate Partners ---
export type PartnerBookingSummary = {
  id: string;
  reference: string;
  status: string;
  collection: string | null;
  destination: string | null;
  pickupAt: string | null;
  amount: number;
  passengerName: string;
};

export type CorporatePartnerRow = {
  id: string;
  companyName: string;
  kvk: string;
  bookerName: string;
  bookerRole: string;
  email: string;
  phone: string;
  preferredVehicle: string;
  status: "Active" | "Pending 2FA" | "Suspended";
  totalSpend: number;
  activeBookings: number;
  partnershipSince: string;
  bookings: PartnerBookingSummary[];
};

const OPEN_BOOKING = ["new", "contacted", "quoted", "confirmed"];

function asBookingSummary(row: {
  id: string;
  reference: string;
  status: string;
  collection: string | null;
  destination: string | null;
  pickupAt: string | null;
  quotedAmount: string | null;
  passengerName: string | null;
  name: string;
}): PartnerBookingSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    collection: row.collection,
    destination: row.destination,
    pickupAt: row.pickupAt,
    amount: Number(row.quotedAmount ?? 0),
    passengerName: row.passengerName || row.name,
  };
}

export const getCorporatePartners = cache(async (): Promise<CorporatePartnerRow[]> => {
  await requireAdmin();
  const contacts = await db.select().from(c).orderBy(asc(c.companyName));

  if (contacts.length === 0) {
    return [];
  }

  const quotes = await db
    .select({
      id: q.id,
      contactId: q.corporateContactId,
      reference: q.reference,
      amount: q.quotedAmount,
      status: q.status,
      phone: q.phone,
      vehicle: q.vehicle,
      collection: q.collection,
      destination: q.destination,
      pickupAt: q.pickupAt,
      passengerName: q.passengerName,
      name: q.name,
      createdAt: q.createdAt,
    })
    .from(q)
    .where(isNotNull(q.corporateContactId));

  return contacts.map((contact) => {
    const contactQuotes = quotes.filter((quote) => quote.contactId === contact.id);
    const totalSpend = contactQuotes.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const activeBookings = contactQuotes.filter((item) => OPEN_BOOKING.includes(item.status)).length;
    const latestPhone = contactQuotes.find((item) => Boolean(item.phone))?.phone ?? "—";
    const preferredKey = contactQuotes.find((item) => Boolean(item.vehicle))?.vehicle;
    const preferredVehicle = preferredKey ? (vehicleByKey(preferredKey)?.name ?? preferredKey) : "—";
    const bookings = contactQuotes
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((item) =>
        asBookingSummary({
          id: item.id,
          reference: item.reference,
          status: item.status,
          collection: item.collection,
          destination: item.destination,
          pickupAt: item.pickupAt,
          quotedAmount: item.amount,
          passengerName: item.passengerName,
          name: item.name,
        }),
      );

    return {
      id: contact.id,
      companyName: contact.companyName || contact.emailDomain || "Enterprise Client",
      kvk: contact.kvkNumber || "—",
      bookerName: contact.name,
      bookerRole: contact.position,
      email: contact.email,
      phone: latestPhone,
      preferredVehicle,
      status: (contact.lockedUntil && contact.lockedUntil > new Date()
        ? "Suspended"
        : contact.verifiedAt
        ? "Active"
        : "Pending 2FA") as "Active" | "Pending 2FA" | "Suspended",
      totalSpend,
      activeBookings,
      partnershipSince: contact.createdAt.getFullYear().toString(),
      bookings,
    };
  });
});

export type CorporatePartnerDetail = {
  partner: CorporatePartnerRow;
  contact: typeof schema.corporateContacts.$inferSelect;
  bookings: (typeof schema.quoteRequests.$inferSelect)[];
  totalSpend: number;
  activeCount: number;
  completedCount: number;
};

export const getCorporatePartnerDetail = cache(async (id: string): Promise<CorporatePartnerDetail | null> => {
  await requireAdmin();
  const [contact] = await db.select().from(c).where(eq(c.id, id)).limit(1);
  if (!contact) return null;

  const bookings = await db.select().from(q).where(eq(q.corporateContactId, id)).orderBy(desc(q.createdAt));
  const totalSpend = bookings.reduce((sum, b) => sum + Number(b.quotedAmount ?? 0), 0);
  const activeCount = bookings.filter((b) => OPEN_BOOKING.includes(b.status)).length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  const partner: CorporatePartnerRow = {
    id: contact.id,
    companyName: contact.companyName || contact.emailDomain || "Enterprise Client",
    kvk: contact.kvkNumber || "—",
    bookerName: contact.name,
    bookerRole: contact.position,
    email: contact.email,
    phone: bookings.find((b) => Boolean(b.phone))?.phone ?? "—",
    preferredVehicle: (() => {
      const key = bookings.find((b) => Boolean(b.vehicle))?.vehicle;
      return key ? (vehicleByKey(key)?.name ?? key) : "—";
    })(),
    status: (contact.lockedUntil && contact.lockedUntil > new Date()
      ? "Suspended"
      : contact.verifiedAt
      ? "Active"
      : "Pending 2FA") as "Active" | "Pending 2FA" | "Suspended",
    totalSpend,
    activeBookings: activeCount,
    partnershipSince: contact.createdAt.getFullYear().toString(),
    bookings: bookings.map((b) => asBookingSummary(b)),
  };

  return { partner, contact, bookings, totalSpend, activeCount, completedCount };
});