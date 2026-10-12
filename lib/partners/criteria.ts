// ─────────────────────────────────────────────────────────────────────────────
//  Criteria an independent driver's car must meet to join the platform, per the
//  client's "Driver & Vehicle Onboarding Specification" (October 2026).
//  Edit them here: the "Drive with us" page, the automatic check at submission and
//  the admin review all read this file.
//
//  Shared by the database schema, server code and client components (no server-only imports).
//
//  This file holds the rules — numbers, model patterns and the logic that applies them. Every
//  human-readable string lives in the dictionaries instead, because the same criteria are shown
//  to Dutch applicants, English applicants and the admin team. Functions that produce text take
//  a `CriteriaLabels` (pass `dictionary.criteria`), so a label change is a translation change
//  and never a code change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The strings the functions below need. `dictionary.criteria` satisfies this structurally, so a
 * dictionary that drifts out of shape fails at the call site rather than at runtime.
 */
export type CriteriaLabels = {
  or: string;
  yes: string;
  no: string;
  unknown: string;
  notInRegister: string;
  /** Keyed by the RDW's own Dutch colour name, e.g. ZWART */
  colours: Record<string, string>;
  /** Keyed by the RDW's own Dutch fuel name, e.g. Elektriciteit */
  fuels: Record<string, string>;
  listModelElectric: string;
  listModelAny: string;
  listFirstRegistered: string;
  listColour: string;
  listSeats: string;
  listTaxiAndApk: string;
  listApkOnly: string;
  listExperience: string;
  checkApprovedModel: string;
  issueApprovedModel: string;
  checkElectric: string;
  issueElectric: string;
  checkFirstRegistered: string;
  issueFirstRegistered: string;
  foundFirstRegistered: string;
  checkSeats: string;
  issueSeats: string;
  foundSeats: string;
  checkTaxi: string;
  issueTaxi: string;
  checkApk: string;
  issueApk: string;
  foundApkExpires: string;
  checkInsured: string;
  issueInsured: string;
  checkColour: string;
  issueColour: string;
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));

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

/** Statements the applicant must confirm; checked by the team before approval. Labels: `declarations.*` */
export const DECLARATIONS = ["permit", "condition"] as const;
export type Declaration = (typeof DECLARATIONS)[number];
export type DeclarationLabels = Record<Declaration, string>;

/** Documents the applicant uploads with the application. Labels: `documents.*` */
export const DOCUMENTS = ["chauffeurCard", "kvkExtract", "vog", "insurance"] as const;
export type DocumentName = (typeof DOCUMENTS)[number];
export type DocumentLabels = Record<DocumentName, { label: string; hint: string }>;
/** Accepted file types and the extension each is stored under */
export const DOCUMENT_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type ApplicationDocument = { name: DocumentName; path: string; size: number; contentType: string };

const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
/**
 * "MERCEDES-BENZ" → "Mercedes-Benz"; short makes such as BMW stay upper case.
 * Not a translation — a make is a proper noun, so this is the same in every language.
 */
export const makeLabel = (make: string) => (make.length <= 3 ? make : title(make));
/** Falls back to title case so a colour the dictionary has not seen still reads sensibly. */
export const colourLabel = (colour: string, colours: Record<string, string>) => colours[colour] ?? title(colour);
const list = (items: string[], or: string) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${or} ${items[items.length - 1]}`;

/** Oldest first-registration year accepted. `today` is YYYY-MM-DD (Netherlands). */
const oldestYear = (today: string) => Number(today.slice(0, 4)) - VEHICLE_CRITERIA.maxAgeYears;

/** Approved models grouped by make, for the public page. */
export const APPROVED_MODELS_BY_MAKE = [...new Set(APPROVED_MODELS.map((m) => m.make))].map((make) => ({
  make: makeLabel(make),
  models: APPROVED_MODELS.filter((m) => m.make === make)
    .map((m) => m.models)
    .join(", "),
}));

/** The criteria as prose, for the public page. `today` is YYYY-MM-DD (Netherlands). */
export const criteriaText = (today: string, t: CriteriaLabels) => [
  VEHICLE_CRITERIA.electricOnly ? t.listModelElectric : t.listModelAny,
  fill(t.listFirstRegistered, { year: oldestYear(today) }),
  ...(VEHICLE_CRITERIA.colours
    ? [fill(t.listColour, { colours: list(VEHICLE_CRITERIA.colours.map((c) => colourLabel(c, t.colours)), t.or) })]
    : []),
  fill(t.listSeats, {
    seats: VEHICLE_CRITERIA.minSeats - 1,
    vanSeats: (APPROVED_MODELS.find((m) => m.minSeats)?.minSeats ?? 1) - 1,
  }),
  ...(VEHICLE_CRITERIA.taxiRegistration ? [t.listTaxiAndApk] : [t.listApkOnly]),
  fill(t.listExperience, { years: DRIVER_CRITERIA.minExperienceYears }),
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
export function vehicleChecks(v: RdwVehicle, today: string, t: CriteriaLabels): VehicleCheck[] {
  const c = VEHICLE_CRITERIA;
  const approved = approvedModel(v.make, v.model);
  const minSeats = approved?.minSeats ?? c.minSeats;
  const electric = v.fuels.length === 1 && v.fuels[0] === "Elektriciteit";
  const car = `${makeLabel(v.make)} ${v.model}`.trim();
  const checks: VehicleCheck[] = [
    {
      label: t.checkApprovedModel,
      ok: !!approved,
      found: car,
      issue: fill(t.issueApprovedModel, { car }),
    },
    {
      label: t.checkElectric,
      ok: !c.electricOnly || electric,
      found: v.fuels.map((f) => t.fuels[f] ?? f).join(", ") || t.unknown,
      issue: t.issueElectric,
    },
    {
      label: fill(t.checkFirstRegistered, { year: oldestYear(today) }),
      ok: v.firstRegistered !== null && Number(v.firstRegistered.slice(0, 4)) >= oldestYear(today),
      found: v.firstRegistered ? fill(t.foundFirstRegistered, { date: v.firstRegistered }) : t.unknown,
      issue: fill(t.issueFirstRegistered, { year: oldestYear(today) }),
    },
    {
      label: fill(t.checkSeats, { seats: minSeats - 1 }),
      // Not every record lists seats; the team checks those in person
      ok: v.seats === null || v.seats >= minSeats,
      found: v.seats === null ? t.notInRegister : fill(t.foundSeats, { seats: v.seats }),
      issue: fill(t.issueSeats, { seats: minSeats - 1 }),
    },
    {
      label: t.checkTaxi,
      ok: !c.taxiRegistration || v.taxiRegistered,
      found: v.taxiRegistered ? t.yes : t.no,
      issue: t.issueTaxi,
    },
    {
      label: t.checkApk,
      ok: v.apkExpires !== null && v.apkExpires >= today,
      found: v.apkExpires ? fill(t.foundApkExpires, { date: v.apkExpires }) : t.unknown,
      issue: t.issueApk,
    },
    {
      label: t.checkInsured,
      ok: v.insured,
      found: v.insured ? t.yes : t.no,
      issue: t.issueInsured,
    },
  ];
  if (c.colours) {
    checks.push({
      label: t.checkColour,
      ok: c.colours.includes(v.colour),
      found: colourLabel(v.colour, t.colours),
      issue: fill(t.issueColour, {
        colours: list(c.colours.map((x) => colourLabel(x, t.colours).toLowerCase()), t.or),
        found: colourLabel(v.colour, t.colours).toLowerCase(),
      }),
    });
  }
  return checks;
}

/** Reasons the car does not meet the criteria (empty when it does). */
export const vehicleIssues = (v: RdwVehicle, today: string, t: CriteriaLabels) =>
  vehicleChecks(v, today, t)
    .filter((c) => !c.ok)
    .map((c) => c.issue);

/** Today's date in the Netherlands, YYYY-MM-DD */
export const amsterdamToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", dateStyle: "short" }).format(new Date());
