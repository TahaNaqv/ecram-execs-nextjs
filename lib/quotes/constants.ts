// Shared by the database schema, server code and client components (no server-only imports here).
export const REQUEST_STATUSES = ["new", "contacted", "quoted", "confirmed", "completed", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SERVICES = [
  "Airport transfer",
  "Business travel",
  "Hourly / as directed",
  "Private occasion",
  "Bespoke programme",
] as const;
