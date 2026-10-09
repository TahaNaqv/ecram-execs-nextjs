// ─────────────────────────────────────────────────────────────────────────────
//  Criteria an independent driver's car must meet to join the platform.
//
//  Client-confirmed: any colour, fully electric luxury vehicles only.
//  ⚠ PENDING — David is sending the vehicle specification; the makes (and possibly an
//  approved model list), age, seats and driver experience may change once it arrives.
//  Edit them here: the "Drive with us" page, the automatic check at submission and
//  the admin review all read this file.
//
//  Shared by the database schema, server code and client components (no server-only imports).
// ─────────────────────────────────────────────────────────────────────────────

export const APPLICATION_STATUSES = ["new", "reviewing", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const VEHICLE_CRITERIA = {
  /** Makes as the RDW registers them (upper case) */
  makes: ["MERCEDES-BENZ", "BMW", "AUDI", "PORSCHE"],
  /** Body colours as the RDW registers them (ZWART = black); null accepts any colour */
  colours: null as string[] | null,
  /** Counted from the date of first registration */
  maxAgeYears: 5,
  /** Including the driver's seat, as the RDW counts them */
  minSeats: 5,
  electricOnly: true,
  /** Paid passenger transport in the Netherlands requires a taxi registration (blue plates) */
  taxiRegistration: true,
};

export const DRIVER_CRITERIA = {
  minExperienceYears: 2,
};

/** Statements the applicant must confirm; checked by the team before approval. */
export const DECLARATIONS = [
  { name: "chauffeurskaart", label: "I hold a valid Dutch chauffeurskaart (taxi driver card)" },
  { name: "permit", label: "My business holds a Kiwa taxi transport licence (vergunning taxivervoer)" },
  { name: "insurance", label: "The car is insured for paid passenger transport" },
  { name: "condition", label: "The car is non-smoking, undamaged and kept to an executive standard inside and out" },
] as const;
export type Declaration = (typeof DECLARATIONS)[number]["name"];

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

/** The criteria in plain English, for the public page and emails. */
export const CRITERIA_TEXT = [
  `${VEHICLE_CRITERIA.electricOnly ? "Fully electric " : ""}${list(VEHICLE_CRITERIA.makes.map(makeLabel))}`,
  `No more than ${VEHICLE_CRITERIA.maxAgeYears} years since first registration`,
  ...(VEHICLE_CRITERIA.colours ? [`${list(VEHICLE_CRITERIA.colours.map(colourLabel))} exterior`] : []),
  `At least ${VEHICLE_CRITERIA.minSeats - 1} passenger seats`,
  ...(VEHICLE_CRITERIA.taxiRegistration ? ["Registered as a taxi with the RDW (blue plates) and a valid APK"] : ["A valid APK"]),
  `At least ${DRIVER_CRITERIA.minExperienceYears} years of professional driving experience`,
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
  const [y, m, d] = today.split("-").map(Number);
  const oldest = `${y - c.maxAgeYears}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const electric = v.fuels.length === 1 && v.fuels[0] === "Elektriciteit";
  const checks: VehicleCheck[] = [
    {
      label: "Make",
      ok: c.makes.includes(v.make),
      found: makeLabel(v.make),
      issue: `We only accept ${list(c.makes.map(makeLabel))} (this car is a ${makeLabel(v.make)}).`,
    },
    {
      label: "Fully electric",
      ok: !c.electricOnly || electric,
      found: v.fuels.map((f) => FUEL_EN[f] ?? f).join(", ") || "Unknown",
      issue: "The car must be fully electric.",
    },
    {
      label: `At most ${c.maxAgeYears} years old`,
      ok: v.firstRegistered !== null && v.firstRegistered >= oldest,
      found: v.firstRegistered ? `First registered ${v.firstRegistered}` : "Unknown",
      issue: `The car must be no more than ${c.maxAgeYears} years old.`,
    },
    {
      label: `At least ${c.minSeats - 1} passenger seats`,
      // Not every record lists seats; the team checks those in person
      ok: v.seats === null || v.seats >= c.minSeats,
      found: v.seats === null ? "Not in the register" : `${v.seats} seats incl. driver`,
      issue: `The car must have at least ${c.minSeats - 1} passenger seats.`,
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
