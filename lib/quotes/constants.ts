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

/** The durations an hourly ("as directed") booking can ask for, in hours. */
export const HOURLY_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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

/**
 * Calling codes offered in the quote form's phone field, the Netherlands first (it is the default). One entry per
 * code, so the select always shows the right one; where several countries share a code the best-known is listed.
 * The format is [digits without "+", ISO country code].
 */
export const COUNTRY_CODES = [
  ["31", "NL"], ["32", "BE"], ["49", "DE"], ["33", "FR"], ["44", "GB"], ["41", "CH"], ["43", "AT"], ["34", "ES"],
  ["39", "IT"], ["352", "LU"], ["351", "PT"], ["353", "IE"], ["45", "DK"], ["46", "SE"], ["47", "NO"], ["358", "FI"],
  ["354", "IS"], ["48", "PL"], ["420", "CZ"], ["421", "SK"], ["36", "HU"], ["40", "RO"], ["359", "BG"], ["30", "GR"],
  ["385", "HR"], ["386", "SI"], ["381", "RS"], ["372", "EE"], ["371", "LV"], ["370", "LT"], ["380", "UA"], ["7", "RU"],
  ["90", "TR"], ["357", "CY"], ["356", "MT"], ["971", "AE"], ["966", "SA"], ["974", "QA"], ["965", "KW"], ["973", "BH"],
  ["968", "OM"], ["972", "IL"], ["962", "JO"], ["961", "LB"], ["20", "EG"], ["212", "MA"], ["27", "ZA"], ["234", "NG"],
  ["254", "KE"], ["1", "US"], ["52", "MX"], ["55", "BR"], ["54", "AR"], ["57", "CO"], ["56", "CL"], ["91", "IN"],
  ["92", "PK"], ["86", "CN"], ["852", "HK"], ["81", "JP"], ["82", "KR"], ["65", "SG"], ["60", "MY"], ["66", "TH"],
  ["62", "ID"], ["63", "PH"], ["84", "VN"], ["61", "AU"], ["64", "NZ"],
] as const;

export const CONTACT_PREFERENCES = ["phone", "whatsapp"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
