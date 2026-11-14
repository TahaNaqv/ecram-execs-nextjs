import {
  type AnyPgColumn,
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
import type { Price } from "@/lib/pricing/rates";
import type { ExtraPick } from "@/lib/pricing/extras";

export { REQUEST_STATUSES, SERVICES, type RequestStatus, type Service } from "@/lib/quotes/constants";
export { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/partners/criteria";

export const requestStatus = pgEnum("request_status", REQUEST_STATUSES);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);
export const serviceKind = pgEnum("service_kind", SERVICES);
export const contentLocale = pgEnum("content_locale", LOCALES);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    status: requestStatus("status").notNull().default("new"),
    collection: text("collection"),
    destination: text("destination"),
    destinations: text("destinations").array(),
    destinationWaits: integer("destination_waits").array(),
    pickupAt: timestamp("pickup_at", { mode: "string" }),
    service: serviceKind("service").notNull(),
    passengers: integer("passengers"),
    luggage: integer("luggage"),
    /** Cabin bags and backpacks. They ride with the guests and are not checked against the boot. */
    handLuggage: integer("hand_luggage"),
    flightNumber: text("flight_number"),
    durationHours: integer("duration_hours"),
    // Minutes the car is held for the trip itself (the buffer after it is added on top): the route's drive time plus an
    // allowance, worked out when the booking is confirmed. Null = not worked out, so the service's estimate is used.
    blockMinutes: integer("block_minutes"),
    // Minutes the car needs after the trip to drive home (lib/fleet/base.ts), from the route, worked out when the booking is
    // confirmed. The car is held for this or the buffer, whichever is longer (the client, 8 Nov 2026). Null = not worked out.
    driveBackMinutes: integer("drive_back_minutes"),
    returnAt: timestamp("return_at", { mode: "string" }),
    passengerName: text("passenger_name"),
    passengerPhone: text("passenger_phone"),
    pickupPlaceId: text("pickup_place_id"),
    destinationPlaceId: text("destination_place_id"),
    entity: text("entity"),
    entityKvk: text("entity_kvk"),
    vehicleClass: text("vehicle_class"),
    itinerary: text("itinerary"),
    contactPreference: text("contact_preference"),
    vehicle: text("vehicle"),
    // How many of `vehicle` the party needs. 1 for a normal booking; 2 or more when the party does not fit in one car.
    vehicleCount: integer("vehicle_count").notNull().default(1),
    // The cars the visitor chose, each with a quantity. Null when they asked us to choose, or for a booking stored before this column.
    vehicles: jsonb("vehicles").$type<{ key: string; count: number }[]>(),
    // The add-ons chosen (lib/pricing/extras.ts), each with how many. Null when none, or for a booking stored before add-ons.
    extras: jsonb("extras").$type<ExtraPick[]>(),
    corporateContactId: uuid("corporate_contact_id").references(() => corporateContacts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes"),
    locale: contentLocale("locale").notNull().default("en"),
    quotedAmount: numeric("quoted_amount", { precision: 10, scale: 2 }),
    // Immutable rate-card snapshot from the moment the request was priced (lib/pricing/rates.ts): the rides, 9% VAT,
    // the 21% service fee and the add-ons. quotedAmount, when the team sets one, is the amount actually charged.
    // Settlement, the VAT split and the euro total are derived from these two when the ledger is read. They are not
    // stored again, and this snapshot is not a foreign key to a live rate card: a later change to the card must not
    // rewrite a booking that has already been made. Null when the card cannot price the request.
    priceEstimate: jsonb("price_estimate").$type<Price>(),
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
    index("quote_requests_contact_created_idx").on(t.corporateContactId, t.createdAt),
    // Dispatch list: confirmed rides ordered by pick-up. The partial predicate matches that filter.
    index("quote_requests_confirmed_pickup_idx").on(t.pickupAt).where(sql`${t.status} = 'confirmed'`),
    // /admin/financials filters and sorts on this exact expression (pick-up wall time, else created in Amsterdam).
    index("quote_requests_activity_idx").on(sql`coalesce(${t.pickupAt}::timestamp, (${t.createdAt} at time zone 'Europe/Amsterdam'))`),
    // The ledger search is a leading-wildcard ILIKE, which a btree cannot serve.
    index("quote_requests_reference_trgm").using("gin", sql`${t.reference} gin_trgm_ops`),
    index("quote_requests_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("quote_requests_email_trgm").using("gin", sql`${t.email} gin_trgm_ops`),
    index("quote_requests_entity_trgm").using("gin", sql`${t.entity} gin_trgm_ops`),
    check("quote_requests_vehicle_count_positive", sql`${t.vehicleCount} >= 1`),
    check("quote_requests_quoted_nonneg", sql`${t.quotedAmount} is null or ${t.quotedAmount} >= 0`),
    check(
      "quote_requests_journey_required",
      sql`${t.service} = 'bespoke' OR (${t.collection} IS NOT NULL AND ${t.pickupAt} IS NOT NULL AND (${t.destination} IS NOT NULL OR (${t.service} = 'hourly' AND ${t.durationHours} IS NOT NULL)))`,
    ),
  ],
);

// Enhanced live vehicles table with real-time battery SoC and RDW telemetry
export const vehicles = pgTable("vehicles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  vin: text("vin"),
  licensePlate: text("license_plate"),
  color: text("color"),
  evRangeKm: integer("ev_range_km").notNull().default(500),
  batterySoC: integer("battery_soc").notNull().default(85), // Live battery percentage
  status: text("status").notNull().default("available"), // "available" | "unavailable" | "maintenance"
  apkExpiry: date("apk_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  iltPermitStatus: text("ilt_permit_status").notNull().default("Valid"),
  /** Public photograph paths, first is the cover. Empty for a car that is only on the operations list. */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  seats: integer("seats"),
  /** Large suitcases the boot takes with the seats in place. */
  luggage: integer("luggage"),
  /** Public hourly rate in euro cents. Saturday and Sunday fall back to the weekday rate when unset. */
  rateWeekday: integer("rate_weekday"),
  rateSaturday: integer("rate_saturday"),
  rateSunday: integer("rate_sunday"),
  /** Shown on the booking form. Operations-only cars stay off the public fleet. */
  listed: boolean("listed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  check("vehicles_battery_range", sql`${t.batterySoC} between 0 and 100`),
  check("vehicles_status_known", sql`${t.status} in ('available', 'unavailable', 'maintenance')`),
]);

export const requestEvents = pgTable(
  "request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    params: jsonb("params").$type<RequestEventParams>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("request_events_request_idx").on(t.requestId, t.createdAt),
    index("request_events_admin_idx").on(t.adminId),
  ],
);

export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    // A website visitor with no account writes as a guest, through the private link to their booking (the client, 8 Nov 2026)
    authorKind: text("author_kind").$type<"partner" | "team" | "guest">().notNull(),
    contactId: uuid("contact_id").references(() => corporateContacts.id, { onDelete: "set null" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    kind: text("kind").$type<"message" | "change" | "cancel">().notNull().default("message"),
    body: text("body").notNull(),
    seenByTeamAt: timestamp("seen_by_team_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_messages_request_idx").on(t.requestId, t.createdAt),
    index("booking_messages_contact_idx").on(t.contactId),
    index("booking_messages_admin_idx").on(t.adminId),
    index("booking_messages_unseen_idx")
      .on(t.requestId)
      .where(sql`${t.authorKind} IN ('partner', 'guest') AND ${t.seenByTeamAt} IS NULL`),
    check("booking_messages_author_kind", sql`${t.authorKind} IN ('partner', 'team', 'guest')`),
    check("booking_messages_kind", sql`${t.kind} IN ('message', 'change', 'cancel')`),
  ],
);

export const bookingInvoices = pgTable(
  "booking_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    fileName: text("file_name").notNull(),
    size: integer("size").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_invoices_request_idx").on(t.requestId, t.createdAt),
    index("booking_invoices_uploader_idx").on(t.uploadedBy),
    index("booking_invoices_filename_trgm").using("gin", sql`${t.fileName} gin_trgm_ops`),
    uniqueIndex("booking_invoices_path_key").on(t.path),
    check("booking_invoices_size_nonneg", sql`${t.size} >= 0`),
  ],
);

/**
 * The booking's invoices in Moneybird (lib/moneybird/sync.ts). One row per invoice or credit invoice we made there.
 * `request_id` is set null when the booking is deleted, so the record of an invoice outlives the booking; `reference` keeps
 * the booking's reference for that case. `state` is ours while we work (`claimed`, `draft`, `failed`) and Moneybird's once
 * it is sent (`open`, `late`, `reminded`, `pending_payment`, `paid`, `uncollectible`, …).
 */
export const moneybirdInvoices = pgTable(
  "moneybird_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => quoteRequests.id, { onDelete: "set null" }),
    reference: text("reference").notNull(),
    /** 1 for the booking's first invoice, 2 after it was credited and the booking confirmed again, … */
    attempt: integer("attempt").notNull().default(1),
    kind: text("kind", { enum: ["invoice", "credit"] }).notNull(),
    creditOf: uuid("credit_of").references((): AnyPgColumn => moneybirdInvoices.id),
    moneybirdId: text("moneybird_id"),
    /** The invoice number, once Moneybird has sent it. */
    number: text("number"),
    state: text("state").notNull(),
    /** "Email" or "Manual": how Moneybird delivers it. */
    delivery: text("delivery"),
    totalCents: integer("total_cents"),
    unpaidCents: integer("unpaid_cents"),
    /** On a credit invoice: the cancellation fee the team kept, in cents (0 for a full credit). */
    feeCents: integer("fee_cents"),
    url: text("url"),
    paymentUrl: text("payment_url"),
    lastError: text("last_error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Set on an invoice once its credit invoice has been made: it is no longer the booking's live invoice. */
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("moneybird_invoices_request_idx").on(t.requestId, t.createdAt),
    // One live invoice per booking: a second confirm, or two people at once, cannot make another
    uniqueIndex("moneybird_invoices_live_key").on(t.requestId).where(sql`${t.kind} = 'invoice' AND ${t.creditedAt} IS NULL`),
    // One credit per invoice
    uniqueIndex("moneybird_invoices_credit_key").on(t.creditOf).where(sql`${t.kind} = 'credit'`),
    uniqueIndex("moneybird_invoices_moneybird_key").on(t.moneybirdId),
    index("moneybird_invoices_state_idx").on(t.state),
    check("moneybird_invoices_kind", sql`${t.kind} in ('invoice', 'credit')`),
    check("moneybird_invoices_credit_link", sql`(${t.kind} = 'credit') = (${t.creditOf} IS NOT NULL)`),
  ],
);

/**
 * Online payments through Mollie (lib/mollie): one row per Mollie payment we started for a booking. Our row is made first
 * and its id is Mollie's Idempotency-Key, so a retry never opens a second payment. `request_id` is set null when the
 * booking is deleted; the record of money taken stays. `mode` is the key's (test or live): rows of the other mode are
 * never counted or swept. One payment at a time per booking (the partial unique index): a customer cannot open two.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => quoteRequests.id, { onDelete: "set null" }),
    reference: text("reference").notNull(),
    mollieId: text("mollie_id"),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    /** Ours while the payment is being made ("creating"), then Mollie's: open, pending, authorized, paid, canceled, expired, failed. */
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    chargedBackCents: integer("charged_back_cents").notNull().default(0),
    method: text("method"),
    checkoutUrl: text("checkout_url"),
    dashboardUrl: text("dashboard_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** When the payment was recorded on the booking's Moneybird invoice (never twice). */
    moneybirdRegisteredAt: timestamp("moneybird_registered_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("payments_request_idx").on(t.requestId, t.createdAt),
    uniqueIndex("payments_mollie_key").on(t.mollieId),
    uniqueIndex("payments_one_open").on(t.requestId, t.mode).where(sql`${t.status} in ('creating', 'open', 'pending', 'authorized')`),
    index("payments_status_idx").on(t.status),
    check("payments_mode", sql`${t.mode} in ('test', 'live')`),
    check("payments_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

/** Refunds of a Mollie payment, made by the team from the booking page. Mollie works them out over time (queued → refunded). */
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    mollieRefundId: text("mollie_refund_id"),
    amountCents: integer("amount_cents").notNull(),
    /** Ours while it is being made ("creating"), then Mollie's: queued, pending, processing, refunded, failed, canceled. */
    status: text("status").notNull(),
    moneybirdRegisteredAt: timestamp("moneybird_registered_at", { withTimezone: true }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("refunds_payment_idx").on(t.paymentId),
    uniqueIndex("refunds_mollie_key").on(t.mollieRefundId),
    index("refunds_admin_idx").on(t.adminId),
    check("refunds_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  locale: contentLocale("locale").notNull().default("en"),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_sessions_admin_idx").on(t.adminId)],
);

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  partner: boolean("partner").notNull().default(false),
  vehicle: text("vehicle"),
  active: boolean("active").notNull().default(true),
  taxipasExpiry: date("taxipas_expiry"),
  vogExpiry: date("vog_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    uniqueIndex("driver_shifts_one_open_idx").on(t.driverId).where(isNull(t.endedAt)),
    index("driver_shifts_driver_started_idx").on(t.driverId, t.startedAt),
    index("driver_shifts_started_by_idx").on(t.startedBy),
    index("driver_shifts_ended_by_idx").on(t.endedBy),
  ],
);

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
    rdwCheckedAt: timestamp("rdw_checked_at", { withTimezone: true }),
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
    index("driver_applications_driver_idx").on(t.driverId),
    index("driver_applications_reviewer_idx").on(t.reviewedBy),
    index("driver_applications_email_trgm").using("gin", sql`${t.email} gin_trgm_ops`),
  ],
);

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
    signatory: text("signatory"),
    pointOfCall: text("point_of_call"),
    phone: text("phone"), // <-- Added phone field to persist direct phone numbers
    // Billing details for the partner's invoices (Moneybird, lib/moneybird). A Dutch invoice to a company carries its address,
    // so a partner booking is invoiced only once street, postcode and city are filled in. The partner fills them in on the portal.
    billingStreet: text("billing_street"),
    billingPostcode: text("billing_postcode"),
    billingCity: text("billing_city"),
    billingCountry: text("billing_country").notNull().default("NL"),
    vatNumber: text("vat_number"),
    /** Where invoices go when it is not the partner's own login email. */
    invoiceEmail: text("invoice_email"),
    /** The partner's contact in Moneybird, once one has been made. */
    moneybirdContactId: text("moneybird_contact_id"),
    locale: contentLocale("locale").notNull().default("en"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
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
  (t) => [
    index("corporate_contacts_created_idx").on(t.createdAt),
    index("corporate_contacts_domain_idx").on(t.emailDomain),
    index("corporate_contacts_company_trgm").using("gin", sql`${t.companyName} gin_trgm_ops`),
    index("corporate_contacts_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const corporateChallenges = pgTable(
  "corporate_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => corporateContacts.id, { onDelete: "cascade" }),
    codeHmac: text("code_hmac").notNull(),
    purpose: text("purpose").$type<"signup" | "reset">().notNull().default("signup"),
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
    check("corporate_challenges_purpose", sql`${t.purpose} in ('signup', 'reset')`),
  ],
);

export const corporateAccess = pgTable(
  "corporate_access",
  {
    id: text("id").primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => corporateContacts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("corporate_access_contact_idx").on(t.contactId)],
);

/**
 * What the website's AI concierge and a visitor said to each other, kept for RETENTION.chatDays days (lib/retention.ts).
 * One row per chat: `session_id` is the anonymous random id the visitor's browser tab made for it (the same one it is
 * rate-limited by). The messages are in `concierge_messages`. `draft` is what the assistant had recorded of a booking
 * at the last message (the visitor's words: it can hold the name, email and phone they gave), and `request_id` the
 * booking request the visitor sent from the chat, if they did: deleting that request deletes the chat with it.
 */
export const conciergeConversations = pgTable(
  "concierge_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull().unique(),
    locale: contentLocale("locale").notNull().default("en"),
    ipHash: text("ip_hash"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    messageCount: integer("message_count").notNull().default(0),
    draft: jsonb("draft").$type<Record<string, unknown>>(),
    requestId: uuid("request_id").references(() => quoteRequests.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("concierge_conversations_last_message_idx").on(t.lastMessageAt),
    index("concierge_conversations_request_idx").on(t.requestId),
    index("concierge_conversations_ip_started_idx").on(t.ipHash, t.startedAt),
  ],
);

export type ConciergeMessageMeta = {
  /** The concierge offered the WhatsApp hand-over */
  handoff?: boolean;
  /** The car carousel was shown with this reply */
  cars?: boolean;
  /** Text meant for the assistant's own reasoning was taken out of the reply before the visitor saw it */
  filtered?: boolean;
  /** The reply is a stored answer, not the model's (it failed, refused or said nothing usable) */
  fallback?: boolean;
  /** The booking was complete after this reply */
  ready?: boolean;
};

export const conciergeMessages = pgTable(
  "concierge_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conciergeConversations.id, { onDelete: "cascade" }),
    /** The order within the chat (the two messages of one turn are saved together, so their times are equal) */
    position: integer("position").notNull(),
    role: text("role", { enum: ["visitor", "concierge"] }).notNull(),
    content: text("content").notNull(),
    meta: jsonb("meta").$type<ConciergeMessageMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("concierge_messages_position_idx").on(t.conversationId, t.position),
    check("concierge_messages_role_check", sql`${t.role} in ('visitor', 'concierge')`),
  ],
);

/** Settings the team changes in the admin, one row per key (the fleet's base: lib/fleet/base.ts). */
export const appSettings = pgTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("app_settings_updated_by_idx").on(t.updatedBy)],
);

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverApplication = typeof driverApplications.$inferSelect;
export type CorporateContact = typeof corporateContacts.$inferSelect;
export type BookingMessage = typeof bookingMessages.$inferSelect;
export type MoneybirdInvoice = typeof moneybirdInvoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type BookingInvoice = typeof bookingInvoices.$inferSelect;
export type ConciergeConversation = typeof conciergeConversations.$inferSelect;
export type ConciergeMessage = typeof conciergeMessages.$inferSelect;
