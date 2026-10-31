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
    flightNumber: text("flight_number"),
    durationHours: integer("duration_hours"),
    // Minutes the car is held for the trip itself (the buffer after it is added on top): the route's drive time plus an
    // allowance, worked out when the booking is confirmed. Null = not worked out, so the service's estimate is used.
    blockMinutes: integer("block_minutes"),
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
    index("quote_requests_contact_created_idx").on(t.corporateContactId, t.createdAt),
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
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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
  (t) => [index("request_events_request_idx").on(t.requestId, t.createdAt)],
);

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
    seenByTeamAt: timestamp("seen_by_team_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_messages_request_idx").on(t.requestId, t.createdAt),
    index("booking_messages_unseen_idx")
      .on(t.requestId)
      .where(sql`${t.authorKind} = 'partner' AND ${t.seenByTeamAt} IS NULL`),
    check("booking_messages_author_kind", sql`${t.authorKind} IN ('partner', 'team')`),
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
    index("booking_invoices_request_idx").on(t.requestId),
    uniqueIndex("booking_invoices_path_key").on(t.path),
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

export const adminSessions = pgTable("admin_sessions", {
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
    phone: text("phone"), // <-- Added phone field to persist direct phone numbers
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
  (t) => [index("corporate_contacts_created_idx").on(t.createdAt), index("corporate_contacts_domain_idx").on(t.emailDomain)],
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
  ],
);

export const corporateAccess = pgTable("corporate_access", {
  id: text("id").primaryKey(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => corporateContacts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverApplication = typeof driverApplications.$inferSelect;
export type CorporateContact = typeof corporateContacts.$inferSelect;
export type BookingMessage = typeof bookingMessages.$inferSelect;
export type BookingInvoice = typeof bookingInvoices.$inferSelect;
export type ConciergeConversation = typeof conciergeConversations.$inferSelect;
export type ConciergeMessage = typeof conciergeMessages.$inferSelect;
