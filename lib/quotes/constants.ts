// Shared by the database schema, server code and client components (no server-only imports here).
export const REQUEST_STATUSES = ["new", "contacted", "quoted", "confirmed", "completed", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Stable keys, never labels. The visitor picks a service in their own language, so the label
 * lives in the dictionaries (`services.*`) and only the key is written to the database.
 * Renaming a key is a data migration; renaming a label is a translation change.
 */
export const SERVICES = ["airport_transfer", "business_travel", "hourly", "private_occasion", "bespoke"] as const;
export type Service = (typeof SERVICES)[number];

/** The English labels this column held before the keys existed, for the one-off migration. */
export const LEGACY_SERVICE_LABELS: Record<string, Service> = {
  "Airport transfer": "airport_transfer",
  "Business travel": "business_travel",
  "Hourly / as directed": "hourly",
  "Private occasion": "private_occasion",
  "Bespoke programme": "bespoke",
};

/**
 * Turns a stored key into a label. Falls back to the raw value so an unrecognised key still
 * shows something in the admin rather than rendering blank.
 */
export const serviceLabel = (service: string, labels: Record<string, string>) => labels[service] ?? service;

/** Stable keys for the bespoke inquiry form; labels live in the dictionaries (`bespokeSection.*`). */
export const VEHICLE_CLASSES = ["executive_sedan", "executive_suv", "mixed_fleet", "advise"] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

/** Calling codes offered as suggestions in the quote form; any 1–4 digit code can still be typed. */
export const COUNTRY_CODES = [
  ["31", "NL"], ["32", "BE"], ["49", "DE"], ["33", "FR"], ["44", "GB"], ["41", "CH"], ["43", "AT"],
  ["34", "ES"], ["39", "IT"], ["45", "DK"], ["46", "SE"], ["47", "NO"], ["48", "PL"], ["352", "LU"],
  ["353", "IE"], ["351", "PT"], ["971", "AE"], ["966", "SA"], ["974", "QA"], ["90", "TR"],
  ["1", "US"], ["7", "RU"], ["81", "JP"], ["86", "CN"], ["91", "IN"],
] as const;

export const CONTACT_PREFERENCES = ["phone", "whatsapp"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
