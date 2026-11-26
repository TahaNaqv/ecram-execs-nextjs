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
    // Paying (lib/payments/schedule.ts, the client's rules of 15 Nov 2026): A = 6 months or more ahead (fee now, the rest
    // 30 days before, approved by itself), B = fee now, the rest 30 days before, C = 30 days or less (everything now).
    // Null for a booking made before these rules, or one with no date or price yet: it is paid in full after approval.
    paymentPlan: text("payment_plan", { enum: ["A", "B", "C"] }),
    /** Corporate invoice terms for the balance (7, 14 or 30 days). Null: the saved card is charged. */
    invoiceTermsDays: integer("invoice_terms_days"),
    /** How the guest said they found Ecram Execs. */
    hearAbout: text("hear_about"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    /** Terms & Conditions version the guest accepted with this booking. */
    termsVersion: text("terms_version"),
    closeProtection: boolean("close_protection").notNull().default(false),
    /** Restricted. Shown only to staff allowed to approve bookings. */
    securityNotes: text("security_notes"),
    /** Current payment status: "PAID", "OPEN", "UNPAID". Synchronized from online payments and test mode. */
    paymentStatus: text("payment_status").default("OPEN"),
    /** What the customer agreed to pay, in cents, when they ticked the terms: nothing above it is charged by itself. */
    consentedCents: integer("consented_cents"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    consentVersion: text("consent_version"),
    consentIpHash: text("consent_ip_hash"),
    /** The booking's customer at Mollie, and the card saved by its first payment (charged for the balance). */
    mollieCustomerId: text("mollie_customer_id"),
    mollieMode: text("mollie_mode", { enum: ["test", "live"] }),
    mollieMandateId: text("mollie_mandate_id"),
    /** The saved card's last day ("YYYY-MM-DD"): a card that runs out before the balance date is flagged. */
    cardExpiresOn: date("card_expires_on", { mode: "string" }),
    cardLabel: text("card_label"),
    // One-time steps of the sweep (lib/mollie/schedule.ts), each claimed by setting its column: never run twice
    autoApproveDoneAt: timestamp("auto_approve_done_at", { withTimezone: true }),
    autoApproveStoppedAt: timestamp("auto_approve_stopped_at", { withTimezone: true }),
    noticeSentAt: timestamp("notice_sent_at", { withTimezone: true }),
    balanceAttemptedAt: timestamp("balance_attempted_at", { withTimezone: true }),
    cardWarnedAt: timestamp("card_warned_at", { withTimezone: true }),
    paidNotifiedAt: timestamp("paid_notified_at", { withTimezone: true }),
    /** Set by "Decline and refund": the team could not take the booking, so everything paid goes back. */
    declinedAt: timestamp("declined_at", { withTimezone: true }),
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
    check("quote_requests_invoice_terms", sql`${t.invoiceTermsDays} is null or ${t.invoiceTermsDays} in (7, 14, 30)`),
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
  /**
   * The printed model (lib/fleet/vehicles.ts VEHICLE_KEYS) chosen when the car was registered: it counts as one more car
   * of that model, priced by the model's rate card. Null for a car typed in by hand, priced by its own rates.
   */
  modelKey: text("model_key"),
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

/** One cost record per battery-electric car: purchase, lease, energy, and the Dutch tax bases. */
export const vehicleFinancials = pgTable(
  "vehicle_financials",
  {
    vehicleId: text("vehicle_id")
      .primaryKey()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    catalogueValue: numeric("catalogue_value", { precision: 12, scale: 2 }).notNull().default("0"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
    leaseMonthlyCost: numeric("lease_monthly_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    batteryCapacityKwh: numeric("battery_capacity_kwh", { precision: 8, scale: 2 }).notNull().default("0"),
    efficiencyKwhPer100Km: numeric("efficiency_kwh_per_100km", { precision: 8, scale: 2 }).notNull().default("0"),
    chargingRateEurPerKwh: numeric("charging_rate_eur_per_kwh", { precision: 8, scale: 4 }).notNull().default("0"),
    insuranceMonthly: numeric("insurance_monthly", { precision: 12, scale: 2 }).notNull().default("0"),
    standardMrbAnnual: numeric("standard_mrb_annual", { precision: 12, scale: 2 }).notNull().default("0"),
    annualKmEstimate: integer("annual_km_estimate").notNull().default(0),
    registrationDate: timestamp("registration_date", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "vehicle_financials_nonneg",
      sql`${t.catalogueValue} >= 0 and ${t.purchasePrice} >= 0 and ${t.leaseMonthlyCost} >= 0 and ${t.batteryCapacityKwh} >= 0 and ${t.efficiencyKwhPer100Km} >= 0 and ${t.chargingRateEurPerKwh} >= 0 and ${t.insuranceMonthly} >= 0 and ${t.standardMrbAnnual} >= 0 and ${t.annualKmEstimate} >= 0`,
    ),
  ],
);

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
    /** On a credit invoice: the kept amount is the service fee's own line (credited is everything but that line). */
    keepFeeLine: boolean("keep_fee_line").notNull().default(false),
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
    /**
     * What the payment is for: "upfront" (at booking, a first card payment that saves the card), "balance" (the rest, charged
     * to that card 30 days before the ride), or "pay" (the Pay button: after approval, a failed charge, a price raise).
     */
    purpose: text("purpose", { enum: ["upfront", "balance", "pay"] }).notNull().default("pay"),
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
  /** Base32 authenticator secret (older rows may be base64url). Empty until a secret is generated. */
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** owner sees every area. manager and staff are limited by `permissions`. */
  role: text("role", { enum: ["owner", "manager", "staff"] }).notNull().default("staff"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminPasswordResets = pgTable(
  "admin_password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_password_resets_admin_idx").on(t.adminId), index("admin_password_resets_expires_idx").on(t.expiresAt)],
);

/** Editable copy for the booking emails. A missing row keeps the built-in wording. */
export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
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
    /** Shift start. Stored as an absolute instant; the board edits it in Europe/Amsterdam local time. */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** Shift end. An open shift is closed at start + 10 hours when nobody ends it first. */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** active while the clock is running, completed when the team ends it, auto_closed at the 10-hour cap. */
    status: text("status").notNull().default("active"),
    startedBy: uuid("started_by").references(() => adminUsers.id, { onDelete: "set null" }),
    endedBy: uuid("ended_by").references(() => adminUsers.id, { onDelete: "set null" }),
    /** The car this shift is responsible for. */
    vehicleId: text("vehicle_id"),
    /** Minutes the team marked as a break, on top of gaps between jobs. */
    breakMinutes: integer("break_minutes").notNull().default(0),
  },
  (t) => [
    uniqueIndex("driver_shifts_one_open_idx").on(t.driverId).where(isNull(t.endedAt)),
    index("driver_shifts_driver_started_idx").on(t.driverId, t.startedAt),
    index("driver_shifts_started_by_idx").on(t.startedBy),
    index("driver_shifts_ended_by_idx").on(t.endedBy),
    check("driver_shifts_status_known", sql`${t.status} in ('active', 'completed', 'auto_closed')`),
  ],
);

/** A driver responsible for one car between two instants, or for the whole 10-hour shift. */
export const driverAssignments = pgTable(
  "driver_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    isEntireShift: boolean("is_entire_shift").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("driver_assignments_driver_start_idx").on(t.driverId, t.startTime),
    index("driver_assignments_vehicle_start_idx").on(t.vehicleId, t.startTime),
    check("driver_assignments_window", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** A break the team recorded by hand. Gaps between jobs are detected and are not stored here. */
export const driverBreakBlocks = pgTable(
  "driver_break_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => driverShifts.id, { onDelete: "set null" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("driver_break_blocks_driver_start_idx").on(t.driverId, t.startTime),
    index("driver_break_blocks_shift_idx").on(t.shiftId),
    check("driver_break_blocks_window", sql`${t.endTime} > ${t.startTime}`),
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
    preferredContact: text("preferred_contact"),
    paymentTermsDays: integer("payment_terms_days"),
    /** Fleet vehicle key the partner prefers, or null when none is assigned. */
    preferredVehicle: text("preferred_vehicle"),
    preferences: text("preferences"),
    accountManagerId: uuid("account_manager_id").references(() => adminUsers.id, { onDelete: "set null" }),
    introducerId: uuid("introducer_id").references((): AnyPgColumn => introducers.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    check("corporate_contacts_payment_terms", sql`${t.paymentTermsDays} is null or ${t.paymentTermsDays} in (7, 14, 30)`),
    check("corporate_contacts_preferred", sql`${t.preferredContact} is null or ${t.preferredContact} in ('email', 'phone', 'whatsapp')`),
  ],
);

/** Someone who introduces corporate partners and is paid commission on their bookings. */
export const introducers = pgTable("introducers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  /** The introducer's own company, if any */
  company: text("company"),
  notes: text("notes"),
  /**
   * The start of the introducer's tenure: their commission steps down by tenure year from this date (lib/admin/commission.ts,
   * 2.5% → 0.5%). Existing introducers were given the day they were added (migration 0038).
   */
  startDate: date("start_date"),
  /** No longer used: the commission follows the tenure schedule since 27 Nov 2026. Kept for the history. */
  commissionPercent: integer("commission_percent").notNull().default(10),
  active: boolean("active").notNull().default(true),
  /** When the monthly invoice request was last emailed to this introducer. */
  lastInvoiceRequestedAt: timestamp("last_invoice_requested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Extra people who may book for one corporate partner. The login itself stays on corporate_contacts. */
export const corporateBookers = pgTable(
  "corporate_bookers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => corporateContacts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    position: text("position"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("corporate_bookers_contact_idx").on(t.contactId)],
);

/** Who changed a corporate partner record, and which field. */
export const corporateAudit = pgTable(
  "corporate_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => corporateContacts.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    field: text("field").notNull(),
    before: text("before"),
    after: text("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("corporate_audit_contact_idx").on(t.contactId, t.createdAt)],
);

export const addonSuppliers = pgTable("addon_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
});

/** Stock for the booking add-ons. Low when on_hand is under 5. */
export const addonStock = pgTable("addon_stock", {
  key: text("key").primaryKey(),
  onHand: integer("on_hand").notNull().default(0),
  supplierId: uuid("supplier_id").references(() => addonSuppliers.id, { onDelete: "set null" }),
});

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
    visitorName: text("visitor_name"),
    visitorEmail: text("visitor_email"),
    followUp: boolean("follow_up").notNull().default(false),
    /** web or whatsapp */
    channel: text("channel").notNull().default("web"),
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

/**
 * The legal documents edited in Settings, every version: the Terms & Conditions ("terms") and the Privacy Policy
 * ("privacy"). A draft is only seen in the admin; the published version with the latest published_at is the one on the
 * website (lib/legal/documents.ts). The table kept its first name from when it held only the terms.
 */
export const termsVersions = pgTable(
  "terms_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doc: text("doc", { enum: ["terms", "privacy"] }).notNull().default("terms"),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    version: text("version").notNull(),
    body: text("body").notNull(),
    /** The date the page shows ("effective" for the terms, "last updated" for the privacy policy) */
    effectiveOn: date("effective_on"),
    savedBy: uuid("saved_by").references(() => adminUsers.id, { onDelete: "set null" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    publishedBy: uuid("published_by").references(() => adminUsers.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("terms_versions_saved_at_idx").on(t.savedAt),
    uniqueIndex("terms_versions_doc_version_key").on(t.doc, t.version),
    index("terms_versions_live_idx").on(t.doc, t.status, t.publishedAt),
    check("terms_versions_doc_check", sql`${t.doc} in ('terms', 'privacy')`),
    check("terms_versions_status_check", sql`${t.status} in ('draft', 'published')`),
  ],
);

/** A service day booked for a car (APK, tyres...): the car takes no bookings that day. */
export const vehicleServices = pgTable(
  "vehicle_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    serviceType: text("service_type").notNull(),
    serviceDate: date("service_date").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vehicle_services_date_idx").on(t.serviceDate), uniqueIndex("vehicle_services_vehicle_day_key").on(t.vehicleId, t.serviceDate)],
);

/**
 * Charges the team adds to a booking after it was made: close protection (the client, 27 Nov 2026), at an amount the team
 * types after arranging it. How it is collected is decided when it is added (lib/payments/charges.ts): more than 30 days
 * before the ride, and not yet paid in full, it joins the booking's total ("balance": the balance charged 30 days before
 * the ride, and the booking's invoice); otherwise it is a charge of its own ("separate": its own Moneybird invoice).
 */
export const bookingCharges = pgTable(
  "booking_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["close_protection"] }).notNull().default("close_protection"),
    description: text("description").notNull(),
    /** Euro cents including VAT */
    amountCents: integer("amount_cents").notNull(),
    /** VAT in basis points: 2100 = 21% */
    vatBasisPoints: integer("vat_basis_points").notNull().default(2100),
    billing: text("billing", { enum: ["balance", "separate"] }).notNull(),
    status: text("status", { enum: ["active", "cancelled"] }).notNull().default("active"),
    /** "balance": when the customer agreed on their booking page to the card being charged for it too */
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /** "separate": its own Moneybird invoice */
    moneybirdId: text("moneybird_id"),
    invoiceNumber: text("invoice_number"),
    invoiceState: text("invoice_state"),
    invoiceUrl: text("invoice_url"),
    invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    lastError: text("last_error"),
    /** When a run took the invoice on (invoice_state "claimed"); a claim older than ten minutes was a run that stopped */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledBy: uuid("cancelled_by").references(() => adminUsers.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("booking_charges_request_idx").on(t.requestId),
    check("booking_charges_amount_check", sql`${t.amountCents} > 0`),
    check("booking_charges_billing_check", sql`${t.billing} in ('balance', 'separate')`),
    check("booking_charges_status_check", sql`${t.status} in ('active', 'cancelled')`),
  ],
);

export type BookingCharge = typeof bookingCharges.$inferSelect;

/**
 * The newsletter list (the client, 27 Nov 2026): everyone who agreed to receive news and offers, from a booking's tick, a
 * corporate partner's sign-up, or added by the team with their consent. One row per address (lower case). "unsubscribed"
 * withdrew (a link in Mailchimp, or the team on their request); "suppressed" asked to be removed and is never added again,
 * not even by a new tick. Mirrored to Mailchimp when it is connected (lib/marketing/mailchimp.ts).
 */
export const marketingContacts = pgTable(
  "marketing_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    source: text("source", { enum: ["booking", "corporate", "manual", "mailchimp"] }).notNull(),
    /** The booking reference or partner the consent came with */
    sourceRef: text("source_ref"),
    status: text("status", { enum: ["subscribed", "unsubscribed", "suppressed"] }).notNull().default("subscribed"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** Mailchimp: true while the change still has to be sent there */
    syncPending: boolean("sync_pending").notNull().default(true),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("marketing_contacts_email_key").on(t.email),
    index("marketing_contacts_status_idx").on(t.status),
    check("marketing_contacts_status_check", sql`${t.status} in ('subscribed', 'unsubscribed', 'suppressed')`),
  ],
);

export type MarketingContact = typeof marketingContacts.$inferSelect;

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
export type VehicleFinancial = typeof vehicleFinancials.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverShift = typeof driverShifts.$inferSelect;
export type DriverAssignment = typeof driverAssignments.$inferSelect;
export type DriverBreakBlock = typeof driverBreakBlocks.$inferSelect;
export type DriverApplication = typeof driverApplications.$inferSelect;
export type CorporateContact = typeof corporateContacts.$inferSelect;
export type BookingMessage = typeof bookingMessages.$inferSelect;
export type MoneybirdInvoice = typeof moneybirdInvoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type BookingInvoice = typeof bookingInvoices.$inferSelect;
export type ConciergeConversation = typeof conciergeConversations.$inferSelect;
export type ConciergeMessage = typeof conciergeMessages.$inferSelect;
