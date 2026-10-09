import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { isNull } from "drizzle-orm";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import { APPLICATION_STATUSES } from "@/lib/partners/criteria";

export { REQUEST_STATUSES, SERVICES, type RequestStatus } from "@/lib/quotes/constants";
export { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/partners/criteria";

export const requestStatus = pgEnum("request_status", REQUEST_STATUSES);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short human-friendly reference shown to the client, e.g. EE-7K3Q9P
    reference: text("reference").notNull().unique(),
    status: requestStatus("status").notNull().default("new"),

    collection: text("collection").notNull(),
    destination: text("destination").notNull(),
    // Wall-clock time in the Netherlands (Europe/Amsterdam), as entered by the client
    pickupAt: timestamp("pickup_at", { mode: "string" }).notNull(),
    service: text("service").notNull(),
    passengers: integer("passengers"),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes"),

    quotedAmount: numeric("quoted_amount", { precision: 10, scale: 2 }),
    internalNotes: text("internal_notes"),

    source: text("source").notNull().default("website"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("quote_requests_status_created_idx").on(t.status, t.createdAt),
    index("quote_requests_ip_created_idx").on(t.ipHash, t.createdAt),
  ],
);

// Audit trail shown on the request detail page
export const requestEvents = pgTable(
  "request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId, t.createdAt)],
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  // SHA-256 of the session token; the raw token only ever lives in the cookie
  id: text("id").primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  // Partners are independent drivers who joined with their own car (see driver_applications)
  partner: boolean("partner").notNull().default(false),
  vehicle: text("vehicle"),
  // Archived drivers are hidden from the board but keep their shift history
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A shift is open while ended_at is null; the countdown runs from started_at
export const driverShifts = pgTable(
  "driver_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    startedBy: uuid("started_by").references(() => adminUsers.id, { onDelete: "set null" }),
    endedBy: uuid("ended_by").references(() => adminUsers.id, { onDelete: "set null" }),
  },
  (t) => [
    // At most one open shift per driver
    uniqueIndex("driver_shifts_one_open_idx").on(t.driverId).where(isNull(t.endedAt)),
    index("driver_shifts_driver_started_idx").on(t.driverId, t.startedAt),
  ],
);

// Independent drivers applying to join with their own car. Vehicle details come from the
// RDW (Dutch vehicle register), looked up from the licence plate at submission.
export const driverApplications = pgTable(
  "driver_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    status: applicationStatus("status").notNull().default("new"),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    kvk: text("kvk").notNull(),
    experienceYears: integer("experience_years").notNull(),
    notes: text("notes"),

    plate: text("plate").notNull(),
    make: text("make"),
    model: text("model"),
    colour: text("colour"),
    seats: integer("seats"),
    firstRegistered: date("first_registered"),
    apkExpires: date("apk_expires"),
    taxiRegistered: boolean("taxi_registered"),
    openRecall: boolean("open_recall"),
    // Null when the RDW couldn't be reached at submission; the team checks the plate by hand
    rdwCheckedAt: timestamp("rdw_checked_at", { withTimezone: true }),

    internalNotes: text("internal_notes"),
    driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => adminUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    source: text("source").notNull().default("website"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("driver_applications_status_created_idx").on(t.status, t.createdAt),
    index("driver_applications_ip_created_idx").on(t.ipHash, t.createdAt),
    index("driver_applications_plate_idx").on(t.plate),
  ],
);

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverApplication = typeof driverApplications.$inferSelect;
