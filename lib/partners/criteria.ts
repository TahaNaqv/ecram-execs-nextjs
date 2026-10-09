// ─────────────────────────────────────────────────────────────────────────────
//  Criteria an independent driver's car must meet to join the platform, per the
//  client's "Driver & Vehicle Onboarding Specification" (October 2026).
//  Edit them here: the "Drive with us" page, the automatic check at submission and
//  the admin review all read this file.
//
//  Shared by the database schema, server code and client components (no server-only imports).
// ─────────────────────────────────────────────────────────────────────────────

export const APPLICATION_STATUSES = ["new", "reviewing", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const VEHICLE_CRITERIA = {
  /** Body colours as the RDW registers them (ZWART = black); null accepts any colour */
  colours: null as string[] | null,
  /** By calendar year: in 2026 a car first registered in 2023 or later qualifies */
  maxAgeYears: 3,
  /** Including the driver's seat, as the RDW counts them; approved models can ask for more */
  minSeats: 5,
  electricOnly: true,
  /** Paid passenger transport in the Netherlands requires a taxi registration (blue plates) */
  taxiRegistration: true,
};

type ApprovedModel = {
  /** As the RDW registers it (upper case) */
  make: string;
  /** For people, e.g. on the public page */
  models: string;
  /** Matched against the RDW trade name after `modelKey` */
  match: RegExp;
  minSeats?: number;
};

/**
 * The only models accepted — anything else (EQA, EQB, iX1, iX2, i4, Q4 e-tron, EX30, EX40,
 * Polestar 2, GV60, Model 3, Model Y…) is turned away. Fuel is checked separately, so the
 * petrol Macan and G80 still fail.
 */
export const APPROVED_MODELS: ApprovedModel[] = [
  { make: "MERCEDES-BENZ", models: "EQE, EQE SUV, EQS, EQS SUV", match: /^(EQE|EQS)\b/ },
  // VIP van: at least 6 passengers
  { make: "MERCEDES-BENZ", models: "EQV", match: /^EQV\b/, minSeats: 7 },
  { make: "BMW", models: "i5, i7, iX", match: /^(I5|I7|IX)\b/ },
  { make: "AUDI", models: "Q8 e-tron, e-tron GT", match: /^(S?Q8\b.*\bE ?TRON\b|(R?S )?E ?TRON GT\b)/ },
  { make: "PORSCHE", models: "Taycan (incl. Cross and Sport Turismo), Macan Electric", match: /^(TAYCAN|MACAN)\b/ },
  { make: "VOLVO", models: "EX90", match: /^EX90\b/ },
  { make: "POLESTAR", models: "Polestar 3, Polestar 5", match: /^[35]\b/ },
  { make: "GENESIS", models: "Electrified G80, GV80, GV90", match: /^(ELECTRIFIED )?(G80|GV80|GV90)\b/ },
  { make: "TESLA", models: "Model S, Model X", match: /^MODEL [SX]\b/ },
  { make: "LUCID MOTORS", models: "Air", match: /^AIR\b/ },
];

/**
 * The RDW trade name in a comparable form: "AMG EQE 53 4MATIC+" → "EQE 53 4MATIC",
 * "Q8 Sportback 55 e-tron" → "Q8 SPORTBACK 55 E TRON", "Tesla Model 3" → "MODEL 3".
 */
const modelKey = (make: string, model: string) => {
  let key = model.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  for (const prefix of [make.replace(/[^A-Z0-9]+/g, " "), make.split(/[ -]/)[0], "AMG"]) {
    if (key.startsWith(`${prefix} `)) key = key.slice(prefix.length + 1);
  }
  return key;
};

export const approvedModel = (make: string, model: string) => {
  const key = modelKey(make, model);
  return APPROVED_MODELS.find((m) => m.make === make && m.match.test(key));
};

export const DRIVER_CRITERIA = {
  minExperienceYears: 2,
};

/** Statements the applicant must confirm; checked by the team before approval. */
export const DECLARATIONS = [
  { name: "permit", label: "My business holds a Kiwa taxi transport licence (vergunning taxivervoer)" },
  { name: "condition", label: "The car is non-smoking, undamaged and kept to an executive standard inside and out" },
] as const;
export type Declaration = (typeof DECLARATIONS)[number]["name"];

/** Documents the applicant uploads with the application. */
export const DOCUMENTS = [
  { name: "chauffeurCard", label: "Chauffeur card", hint: "Chauffeurskaart / taxipas" },
  { name: "kvkExtract", label: "KvK extract", hint: "Chamber of Commerce extract" },
  { name: "vog", label: "VOG", hint: "Certificate of conduct, profile 70" },
  { name: "insurance", label: "Insurance", hint: "Cover for paid passenger transport" },
] as const;
export type DocumentName = (typeof DOCUMENTS)[number]["name"];
/** Accepted file types and the extension each is stored under */
export const DOCUMENT_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type ApplicationDocument = { name: DocumentName; path: string; size: number; contentType: string };

export const COLOUR_EN: Record<string, string> = {
  ZWART: "Black",
  GRIJS: "Grey",
  WIT: "White",
  BLAUW: "Blue",
  ZILVER: "Silver",
  ROOD: "Red",
  GROEN: "Green",
  BRUIN: "Brown",
  BEIGE: "Beige",
};

const FUEL_EN: Record<string, string> = { Elektriciteit: "Electric", Benzine: "Petrol", Diesel: "Diesel", Waterstof: "Hydrogen" };

const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
/** "MERCEDES-BENZ" → "Mercedes-Benz"; short makes such as BMW stay upper case */
export const makeLabel = (make: string) => (make.length <= 3 ? make : title(make));
export const colourLabel = (colour: string) => COLOUR_EN[colour] ?? title(colour);
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

/** Oldest first-registration year accepted. `today` is YYYY-MM-DD (Netherlands). */
const oldestYear = (today: string) => Number(today.slice(0, 4)) - VEHICLE_CRITERIA.maxAgeYears;

/** Approved models grouped by make, for the public page. */
export const APPROVED_MODELS_BY_MAKE = [...new Set(APPROVED_MODELS.map((m) => m.make))].map((make) => ({
  make: makeLabel(make),
  models: APPROVED_MODELS.filter((m) => m.make === make)
    .map((m) => m.models)
    .join(", "),
}));

/** The criteria in plain English, for the public page. `today` is YYYY-MM-DD (Netherlands). */
export const criteriaText = (today: string) => [
  `${VEHICLE_CRITERIA.electricOnly ? "Fully electric (no hybrids) and " : ""}on our approved model list`,
  `First registered in ${oldestYear(today)} or later`,
  ...(VEHICLE_CRITERIA.colours ? [`${list(VEHICLE_CRITERIA.colours.map(colourLabel))} exterior`] : []),
  `At least ${VEHICLE_CRITERIA.minSeats - 1} passenger seats, or ${(APPROVED_MODELS.find((m) => m.minSeats)?.minSeats ?? 1) - 1} in a van`,
  ...(VEHICLE_CRITERIA.taxiRegistration ? ["Registered as a taxi with the RDW (blue plates) and a valid APK"] : ["A valid APK"]),
  `At least ${DRIVER_CRITERIA.minExperienceYears} years of professional chauffeur experience`,
];

/** What the RDW knows about a car, reduced to the fields the criteria need. */
export type RdwVehicle = {
  plate: string;
  make: string;
  model: string;
  colour: string;
  seats: number | null;
  /** YYYY-MM-DD */
  firstRegistered: string | null;
  apkExpires: string | null;
  fuels: string[];
  taxiRegistered: boolean;
  insured: boolean;
  openRecall: boolean;
};

export type VehicleCheck = { label: string; ok: boolean; found: string; issue: string };

/** Each vehicle criterion checked against the RDW record. `today` is YYYY-MM-DD (Netherlands). */
export function vehicleChecks(v: RdwVehicle, today: string): VehicleCheck[] {
  const c = VEHICLE_CRITERIA;
  const approved = approvedModel(v.make, v.model);
  const minSeats = approved?.minSeats ?? c.minSeats;
  const electric = v.fuels.length === 1 && v.fuels[0] === "Elektriciteit";
  const car = `${makeLabel(v.make)} ${v.model}`.trim();
  const checks: VehicleCheck[] = [
    {
      label: "Approved model",
      ok: !!approved,
      found: car,
      issue: `The ${car} isn't on our approved model list.`,
    },
    {
      label: "Fully electric",
      ok: !c.electricOnly || electric,
      found: v.fuels.map((f) => FUEL_EN[f] ?? f).join(", ") || "Unknown",
      issue: "The car must be fully electric (hybrids aren't accepted).",
    },
    {
      label: `First registered in ${oldestYear(today)} or later`,
      ok: v.firstRegistered !== null && Number(v.firstRegistered.slice(0, 4)) >= oldestYear(today),
      found: v.firstRegistered ? `First registered ${v.firstRegistered}` : "Unknown",
      issue: `The car must be first registered in ${oldestYear(today)} or later.`,
    },
    {
      label: `At least ${minSeats - 1} passenger seats`,
      // Not every record lists seats; the team checks those in person
      ok: v.seats === null || v.seats >= minSeats,
      found: v.seats === null ? "Not in the register" : `${v.seats} seats incl. driver`,
      issue: `The car must have at least ${minSeats - 1} passenger seats.`,
    },
    {
      label: "Taxi registration",
      ok: !c.taxiRegistration || v.taxiRegistered,
      found: v.taxiRegistered ? "Yes" : "No",
      issue: "The car must be registered as a taxi with the RDW (blue plates).",
    },
    {
      label: "Valid APK",
      ok: v.apkExpires !== null && v.apkExpires >= today,
      found: v.apkExpires ? `Expires ${v.apkExpires}` : "Unknown",
      issue: "The car's APK has expired.",
    },
    {
      label: "Insured",
      ok: v.insured,
      found: v.insured ? "Yes" : "No",
      issue: "The RDW has no valid insurance on record for this car.",
    },
  ];
  if (c.colours) {
    checks.push({
      label: "Colour",
      ok: c.colours.includes(v.colour),
      found: colourLabel(v.colour),
      issue: `The car must be ${list(c.colours.map((x) => colourLabel(x).toLowerCase()))} (the RDW lists it as ${colourLabel(v.colour).toLowerCase()}).`,
    });
  }
  return checks;
}

/** Reasons the car does not meet the criteria (empty when it does). */
export const vehicleIssues = (v: RdwVehicle, today: string) =>
  vehicleChecks(v, today)
    .filter((c) => !c.ok)
    .map((c) => c.issue);

/** Today's date in the Netherlands, YYYY-MM-DD */
export const amsterdamToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", dateStyle: "short" }).format(new Date());
