/**
 * A driver's compliance, worked out from the profile (the client, 28 Nov 2026). Pure, so the board, the profile page, the
 * alerts and the dispatch check all judge a driver the same way. Dates are Amsterdam calendar dates (YYYY-MM-DD).
 *
 * Auto-suspension is worked out, not stored: entering a renewed expiry date lifts it straight away, while a suspension
 * the team sets by hand stays until the team lifts it.
 */

export const DRIVER_TYPES = ["agency", "freelance"] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];

export const ACCOUNT_STATUSES = ["active", "pending", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const MEDICAL_STATUSES = ["missing", "submitted", "approved"] as const;
export type MedicalStatus = (typeof MEDICAL_STATUSES)[number];

export const KIWA_CARD_TYPES = ["full", "limited"] as const;

/** Days before an expiry date at which the team is told (the client: 60, 30 and 7 days). */
export const ALERT_DAYS = [60, 30, 7] as const;

/** The expiry dates a driver must keep valid. */
export type ExpiryKey = "licence" | "chauffeurskaart" | "permit" | "ondernemerskaart" | "insurance" | "apk" | "code95";

export type ComplianceDriver = {
  driverType: string;
  accountStatus: string;
  licenceNumber: string | null;
  licenceExpiry: string | null;
  catB: boolean;
  catBeCode96: boolean;
  catDCode95: boolean;
  /** Code 95 has its own expiry; it only matters for the eSprinter, so it never suspends the driver. */
  code95Expiry: string | null;
  noPrivateCodes: boolean;
  kiwaCardNumber: string | null;
  kiwaCardType: string | null;
  /** The Kiwa Chauffeurskaart's expiry (the column was named after the old "taxipas"). */
  taxipasExpiry: string | null;
  cdtCheckedOn: string | null;
  vogIssuedOn: string | null;
  vogVerified: boolean;
  medicalStatus: string;
  kvk: string | null;
  iban: string | null;
  permitNumber: string | null;
  permitExpiry: string | null;
  ondernemerskaartNumber: string | null;
  ondernemerskaartExpiry: string | null;
  insurer: string | null;
  insurancePolicy: string | null;
  insuranceExpiry: string | null;
};

export type ComplianceVehicle = { id: string; label: string; apkExpiry: string | null };

export type Expiry = { key: ExpiryKey; date: string | null; /** For an own vehicle's APK: which vehicle */ vehicleId?: string; vehicleLabel?: string };

/** What is missing before the driver can be set Active. */
export type MissingKey =
  | "licence"
  | "catB"
  | "noPrivateCodes"
  | "chauffeurskaart"
  | "cdt"
  | "vog"
  | "medical"
  | "kvk"
  | "iban"
  | "permit"
  | "ondernemerskaart"
  | "insurance"
  | "ownVehicle";

/** Dates the team is reminded of without them suspending anyone: Code 95, for drivers who have it. */
function reminderOnlyExpiries(driver: ComplianceDriver): Expiry[] {
  return driver.catDCode95 ? [{ key: "code95", date: driver.code95Expiry }] : [];
}

export type DueSoon = Expiry & { date: string; days: number; tier: (typeof ALERT_DAYS)[number] };

export type Compliance = {
  /** What dispatch and the board go by. */
  status: AccountStatus;
  /** Suspended because a mandatory document has expired (not by the team). */
  autoSuspended: boolean;
  expired: (Expiry & { date: string })[];
  missing: MissingKey[];
  dueSoon: DueSoon[];
};

const isFreelance = (driver: Pick<ComplianceDriver, "driverType">) => driver.driverType === "freelance";

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The tightest alert tier a date falls in: 7 when it is a week away or less, else 30, else 60; null when further off. */
export function alertTier(days: number): (typeof ALERT_DAYS)[number] | null {
  if (days < 0) return null;
  for (const tier of [...ALERT_DAYS].reverse()) if (days <= tier) return tier;
  return null;
}

/** Every expiry date that must stay valid: the licence and the Chauffeurskaart for all; a freelancer's permits, insurance and own cars' APK too. */
export function mandatoryExpiries(driver: ComplianceDriver, ownVehicles: ComplianceVehicle[] = []): Expiry[] {
  const list: Expiry[] = [
    { key: "licence", date: driver.licenceExpiry },
    { key: "chauffeurskaart", date: driver.taxipasExpiry },
  ];
  if (isFreelance(driver)) {
    list.push({ key: "permit", date: driver.permitExpiry }, { key: "ondernemerskaart", date: driver.ondernemerskaartExpiry }, { key: "insurance", date: driver.insuranceExpiry });
    for (const car of ownVehicles) list.push({ key: "apk", date: car.apkExpiry, vehicleId: car.id, vehicleLabel: car.label });
  }
  return list;
}

/** What the profile still lacks before the driver may be set Active. */
export function missingForActive(driver: ComplianceDriver, ownVehicles: ComplianceVehicle[] = []): MissingKey[] {
  const missing: MissingKey[] = [];
  const has = (value: string | null | undefined) => Boolean(value && value.trim());
  if (!has(driver.licenceNumber) || !driver.licenceExpiry) missing.push("licence");
  if (!driver.catB) missing.push("catB");
  if (!driver.noPrivateCodes) missing.push("noPrivateCodes");
  if (!has(driver.kiwaCardNumber) || !driver.kiwaCardType || !driver.taxipasExpiry) missing.push("chauffeurskaart");
  if (!driver.cdtCheckedOn) missing.push("cdt");
  if (!driver.vogIssuedOn || !driver.vogVerified) missing.push("vog");
  if (driver.medicalStatus !== "approved") missing.push("medical");
  if (isFreelance(driver)) {
    if (!has(driver.kvk)) missing.push("kvk");
    if (!has(driver.iban)) missing.push("iban");
    if (!has(driver.permitNumber) || !driver.permitExpiry) missing.push("permit");
    if (!has(driver.ondernemerskaartNumber) || !driver.ondernemerskaartExpiry) missing.push("ondernemerskaart");
    if (!has(driver.insurer) || !has(driver.insurancePolicy) || !driver.insuranceExpiry) missing.push("insurance");
    if (!ownVehicles.some((car) => car.apkExpiry)) missing.push("ownVehicle");
  }
  return missing;
}

/**
 * The driver's standing on `today`, or on `at` when given (dispatch judges a link by the day it ends, so a licence that
 * runs out during the link counts as expired).
 */
export function driverCompliance(driver: ComplianceDriver, ownVehicles: ComplianceVehicle[], today: string, at: string = today): Compliance {
  const expiries = mandatoryExpiries(driver, ownVehicles);
  const expired = expiries.filter((e): e is Expiry & { date: string } => Boolean(e.date && e.date < at));
  const dueSoon: DueSoon[] = [];
  for (const e of [...expiries, ...reminderOnlyExpiries(driver)]) {
    if (!e.date || e.date < at) continue;
    const days = daysBetween(today, e.date);
    const tier = alertTier(days);
    if (tier) dueSoon.push({ ...e, date: e.date, days, tier });
  }
  dueSoon.sort((a, b) => a.days - b.days);
  const missing = missingForActive(driver, ownVehicles);
  const manual: AccountStatus = (ACCOUNT_STATUSES as readonly string[]).includes(driver.accountStatus) ? (driver.accountStatus as AccountStatus) : "pending";
  const autoSuspended = manual !== "suspended" && expired.length > 0;
  // An Active driver whose profile has lost a required piece (e.g. the medical declaration reopened) is back to pending
  const status: AccountStatus = manual === "suspended" || autoSuspended ? "suspended" : manual === "active" && missing.length === 0 ? "active" : "pending";
  return { status, autoSuspended, expired, missing, dueSoon };
}

// ── Dispatch ─────────────────────────────────────────────────────────────────────────────────────────────────

export type DispatchBlock =
  | { reason: "suspended"; expired: ExpiryKey[] }
  | { reason: "pending"; missing: MissingKey[] }
  | { reason: "carApk" }
  | { reason: "carInsurance" }
  | { reason: "eSprinter" }
  | { reason: "code95Expired" }
  | { reason: "trailer"; reference: string }
  | { reason: "notAuthorised" }
  | { reason: "induction"; which: "ev" | "trailer" };

export type DispatchDriver = ComplianceDriver & {
  evInduction: boolean;
  trailerInduction: boolean;
  /** The models (lib/fleet/vehicles.ts keys, or a car's own id when it has no model) an agency driver may drive. */
  authorisedModels: string[];
};

/**
 * Whether this driver may be linked to this company car for a window ending on `endDate`. The first reason found is
 * returned, null when the link may go ahead. Valid through the expiry day: a date counts as expired when it is before the day. `trailerBooking` is the reference of a booking that tows the Debon trailer
 * behind this car's model during the window, if any.
 */
export function dispatchBlock(input: {
  driver: DispatchDriver;
  ownVehicles: ComplianceVehicle[];
  /** `key`: the car's model (vehicleModel(row)), or its own id when it has none. */
  car: { key: string; apkExpiry: string | null; insuranceExpiry: string | null };
  today: string;
  endDate: string;
  trailerBooking: string | null;
}): DispatchBlock | null {
  const { driver, car, endDate } = input;
  const standing = driverCompliance(driver, input.ownVehicles, input.today, endDate);
  if (standing.status === "suspended") return { reason: "suspended", expired: standing.expired.map((e) => e.key) };
  if (standing.status === "pending") return { reason: "pending", missing: standing.missing };
  if (car.apkExpiry && car.apkExpiry < endDate) return { reason: "carApk" };
  if (car.insuranceExpiry && car.insuranceExpiry < endDate) return { reason: "carInsurance" };
  if (car.key === ESPRINTER_KEY && !driver.catDCode95) return { reason: "eSprinter" };
  if (car.key === ESPRINTER_KEY && (!driver.code95Expiry || driver.code95Expiry < endDate)) return { reason: "code95Expired" };
  if (input.trailerBooking && !driver.catBeCode96) return { reason: "trailer", reference: input.trailerBooking };
  if (driver.driverType === "agency") {
    if (!driver.authorisedModels.includes(car.key)) return { reason: "notAuthorised" };
    // Every company car is electric
    if (!driver.evInduction) return { reason: "induction", which: "ev" };
    if (input.trailerBooking && !driver.trailerInduction) return { reason: "induction", which: "trailer" };
  }
  return null;
}

/** The 16-seat eSprinter: only drivers with D1 / D and Code 95 (the client, 28 Nov 2026). */
export const ESPRINTER_KEY = "mercedes_esprinter";

// ── Checks on what the team types ─────────────────────────────────────────────────────────────────────────────

/** IBAN with a valid ISO 13616 check (mod 97). Spaces are allowed when typed; the stored form has none, upper case. */
export function normaliseIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1 ? iban : null;
}

/** KvK numbers are 8 digits. */
export const normaliseKvk = (raw: string) => {
  const digits = raw.replace(/\s+/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
};

/** A Dutch VAT id: NL, nine digits, B, two digits. */
export const normaliseBtw = (raw: string) => {
  const id = raw.replace(/[\s.]+/g, "").toUpperCase();
  return /^NL\d{9}B\d{2}$/.test(id) ? id : null;
};

/** A licence plate as the RDW writes it: letters and digits, no dashes or spaces. */
export const normalisePlate = (raw: string) => {
  const plate = raw.replace(/[\s-]+/g, "").toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(plate) ? plate : null;
};

/** Short names for the expiry and missing keys, in English, for server messages (the profile page uses the dictionary). */
export const COMPLIANCE_LABELS: Record<ExpiryKey | MissingKey, string> = {
  licence: "driving licence",
  chauffeurskaart: "Kiwa Chauffeurskaart",
  permit: "Kiwa taxi permit",
  ondernemerskaart: "Ondernemerskaart",
  insurance: "taxi insurance",
  apk: "own car's APK",
  code95: "Code 95",
  catB: "category B",
  noPrivateCodes: "no private-use codes confirmed",
  cdt: "CDT check",
  vog: "VOG",
  medical: "medical declaration",
  kvk: "KvK number",
  iban: "IBAN",
  ownVehicle: "own car with an APK date",
};
