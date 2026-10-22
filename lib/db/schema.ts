import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { isNull, sql } from "drizzle-orm";
import { REQUEST_STATUSES, SERVICES } from "@/lib/quotes/constants";
import { APPLICATION_STATUSES, type ApplicationDocument } from "@/lib/partners/criteria";
import { LOCALES } from "@/lib/i18n/config";
import type { RequestEventParams } from "@/lib/admin/events";

export { REQUEST_STATUSES, SERVICES, type RequestStatus, type Service } from "@/lib/quotes/constants";
export { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/partners/criteria";

export const requestStatus = pgEnum("request_status", REQUEST_STATUSES);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);
// A closed set with meaning in the UI, so an enum like the statuses above.
export const serviceKind = pgEnum("service_kind", SERVICES);
/** The language the visitor used, so replies and confirmation emails match it. */
export const contentLocale = pgEnum("content_locale", LOCALES);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short human-friendly reference shown to the client, e.g. EE-7K3Q9P
    reference: text("reference").notNull().unique(),
    status: requestStatus("status").notNull().default("new"),

    // Required for every service except `bespoke` (see the check constraint below): a bespoke
    // programme has an itinerary, not a single pick-up and drop-off.
    collection: text("collection"),
    destination: text("destination"),
    destinations: text("destinations").array(),
    // Minutes the chauffeur waits at each stop in `destinations`, same length and order. Null on requests made before
    // waiting times existed, and where there are no stops (lib/quotes/stops.ts)
    destinationWaits: integer("destination_waits").array(),
    // Wall-clock time in the Netherlands (Europe/Amsterdam), as entered by the client
    pickupAt: timestamp("pickup_at", { mode: "string" }),
    service: serviceKind("service").notNull(),
    passengers: integer("passengers"),
    // Suitcases, so the team (and the car step) can tell what fits
    luggage: integer("luggage"),
    // As typed: an airline flight ("KL 1002") or a private flight's registration
    flightNumber: text("flight_number"),
    // An hourly booking ("as directed") has a duration instead of a destination; see the check constraint below
    durationHours: integer("duration_hours"),
    // The return journey, when asked for: same wall-clock convention as `pickup_at`, quoted together with it
    returnAt: timestamp("return_at", { mode: "string" }),
    // The person travelling, when the booker books for someone else; null when the booker travels
    passengerName: text("passenger_name"),
    passengerPhone: text("passenger_phone"),
    // Google place ids of the picked addresses (only the id: Google's terms forbid keeping their place data)
    pickupPlaceId: text("pickup_place_id"),
    destinationPlaceId: text("destination_place_id"),

    // Bespoke inquiries only
    entity: text("entity"),
    // KvK number when the company was picked from the registry search; null when typed in by hand
    entityKvk: text("entity_kvk"),
    vehicleClass: text("vehicle_class"),
    itinerary: text("itinerary"),
    contactPreference: text("contact_preference"),

    // A fleet vehicle the client chose (a key from lib/fleet/vehicles.ts); `vehicle_class` is the
    // broader class asked for on the bespoke form
    vehicle: text("vehicle"),

    // Set when the request came through the verified Corporate Partner area
    corporateContactId: uuid("corporate_contact_id").references(() => corporateContacts.id, { onDelete: "set null" }),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes"),
    locale: contentLocale("locale").notNull().default("en"),

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
    // A partner's own bookings, newest first (the portal lists them by this)
    index("quote_requests_contact_created_idx").on(t.corporateContactId, t.createdAt),
    // Every journey has a pick-up and a time, and either a destination or (hourly only) a duration
    check(
      "quote_requests_journey_required",
      sql`${t.service} = 'bespoke' OR (${t.collection} IS NOT NULL AND ${t.pickupAt} IS NOT NULL AND (${t.destination} IS NOT NULL OR (${t.service} = 'hourly' AND ${t.durationHours} IS NOT NULL)))`,
    ),
  ],
);

// Fleet vehicles table to track real-time availability status
export const vehicles = pgTable("vehicles", {
  id: text("id").primaryKey(), // matches keys from lib/fleet/vehicles.ts
  name: text("name").notNull(),
  status: text("status").notNull().default("available"), // "available" | "unavailable"
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Audit trail shown on the request detail page
export const requestEvents = pgTable(
  "request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    /**
     * What happened, as a key — never prose. Prose would freeze the audit trail in whichever
     * language wrote it, so a bilingual admin could never render old history correctly.
     * Deliberately `text` rather than an enum: the event vocabulary grows over time, and a log
     * should not need a schema migration to record a new kind of event.
     */
    event: text("event").notNull(),
    /** Values the label interpolates (status from/to, amounts, legacy prose). */
    params: jsonb("params").$type<RequestEventParams>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId, t.createdAt)],
);

/**
 * The conversation between a partner and the team about one booking: messages, and requests to change or cancel it.
 * A change or cancel REQUEST never alters the booking by itself; the team does that in the admin. Not mirrored into
 * request_events (the thread is merged into the history when it is shown), so there is one record of each message.
 */
export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    authorKind: text("author_kind").$type<"partner" | "team">().notNull(),
    contactId: uuid("contact_id").references(() => corporateContacts.id, { onDelete: "set null" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    kind: text("kind").$type<"message" | "change" | "cancel">().notNull().default("message"),
    body: text("body").notNull(),
    // When a team member first opened the booking after a partner message (drives the badge in the admin list)
    seenByTeamAt: timestamp("seen_by_team_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_messages_request_idx").on(t.requestId, t.createdAt),
    // Only unseen partner messages: tiny, and exactly what the badge counts
    index("booking_messages_unseen_idx")
      .on(t.requestId)
      .where(sql`${t.authorKind} = 'partner' AND ${t.seenByTeamAt} IS NULL`),
    check("booking_messages_author_kind", sql`${t.authorKind} IN ('partner', 'team')`),
    check("booking_messages_kind", sql`${t.kind} IN ('message', 'change', 'cancel')`),
  ],
);

/** An invoice PDF the team attached to a booking. The file lives in document storage (lib/storage.ts) at `path`. */
export const bookingInvoices = pgTable(
  "booking_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    // <folder-uuid>/invoice.pdf — what storage accepts; the name the partner sees is `fileName`
    path: text("path").notNull(),
    fileName: text("file_name").notNull(),
    size: integer("size").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_invoices_request_idx").on(t.requestId),
    // One stored file belongs to exactly one invoice row: a path recorded against two requests would let one request's
    // deletion remove the file from under the other, and one partner download another's
    uniqueIndex("booking_invoices_path_key").on(t.path),
  ],
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Which language this admin sees the panel in. Admin is not locale-routed; see D3. */
  locale: contentLocale("locale").notNull().default("en"),
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
    locale: contentLocale("locale").notNull().default("en"),

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
    // Stored privately (server disk or Supabase Storage, see lib/storage.ts); null on applications made before uploads existed
    documents: jsonb("documents").$type<ApplicationDocument[]>(),

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

// People who asked for access to the Corporate Partner area. Also the corporate mailing list, which is
// why consent is recorded here: the verification email is transactional, marketing needs an explicit opt-in.
export const corporateContacts = pgTable(
  "corporate_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    emailDomain: text("email_domain").notNull(),
    name: text("name").notNull(),
    position: text("position").notNull(),
    companyName: text("company_name"),
    kvkNumber: text("kvk_number"),
    locale: contentLocale("locale").notNull().default("en"),
    // Set the first time the emailed code is entered correctly
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    // The account: set by the person at sign-up (or a password reset), after the emailed code proved the address.
    // Null until then. scrypt, in the same format as admin users (lib/auth/password.ts). Never select this column
    // outside the sign-in and password actions (see lib/corporate/access.ts).
    passwordHash: text("password_hash"),
    passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
    // Sign-in lockout, counted in one atomic UPDATE (lib/corporate/account-actions.ts)
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    // Which wording the person agreed to, so a later change to the text doesn't rewrite history
    consentTextVersion: text("consent_text_version"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    source: text("source").notNull().default("website"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("corporate_contacts_created_idx").on(t.createdAt), index("corporate_contacts_domain_idx").on(t.emailDomain)],
);

// One row per emailed code. The code itself is never stored, only an HMAC of it (a six-digit code
// has too few possibilities to survive a plain hash).
export const corporateChallenges = pgTable(
  "corporate_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => corporateContacts.id, { onDelete: "cascade" }),
    codeHmac: text("code_hmac").notNull(),
    // What the code is for: creating an account ("signup") or choosing a new password ("reset"). The code only ever
    // completes the purpose it was issued for.
    purpose: text("purpose").$type<"signup" | "reset">().notNull().default("signup"),
    // What the person typed, held here until the code is entered. Nothing about a contact (or any
    // marketing consent) changes on the strength of an unverified request: this is applied in verifyCode.
    pendingName: text("pending_name"),
    pendingPosition: text("pending_position"),
    pendingConsent: boolean("pending_consent").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("corporate_challenges_contact_created_idx").on(t.contactId, t.createdAt),
    index("corporate_challenges_ip_created_idx").on(t.ipHash, t.createdAt),
  ],
);

// Access to the restricted form after a correct code. Like admin sessions, the id is the SHA-256 of
// the cookie's token, so the database never holds a usable credential.
export const corporateAccess = pgTable("corporate_access", {
  id: text("id").primaryKey(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => corporateContacts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverApplication = typeof driverApplications.$inferSelect;
export type CorporateContact = typeof corporateContacts.$inferSelect;
export type BookingMessage = typeof bookingMessages.$inferSelect;
export type BookingInvoice = typeof bookingInvoices.$inferSelect;