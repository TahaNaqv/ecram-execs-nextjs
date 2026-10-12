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
