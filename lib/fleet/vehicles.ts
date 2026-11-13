/**
 * The fleet, as data. Brand names are shown as-is in every language, so they live here rather than in
 * the dictionaries; anything a visitor reads in a sentence (questions, amenity labels) is in the
 * dictionaries under `fleetSection`.
 *
 * `specs` is deliberately empty until a vehicle's model and configuration are confirmed against the
 * manufacturer's own figures. The site only shows answers it can back, so an unverified vehicle
 * renders without the specification Q&A rather than with a guess.
 */

export const VEHICLE_KEYS = ["mercedes_vle_300", "audi", "cadillac_escalade", "range_rover", "hongqi_e_hs9"] as const;
export type VehicleKey = (typeof VEHICLE_KEYS)[number];

export type Amenity = "executive_seating" | "in_car_screens" | "entertainment" | "climate_control" | "refreshments";

/** Manufacturer-confirmed facts for one model and configuration. All of it must be sourced. */
export type VehicleSpecs = {
  passengers: number;
  /** Stated electric range on a full charge. */
  rangeKm: number;
  /** The test cycle the figure comes from. WLTP is the European standard; EPA is the US one and reads higher. */
  rangeStandard: "WLTP" | "EPA";
  /** Free-text per language: how much luggage fits. Left out when sources disagree: no answer beats a wrong one. */
  luggage?: Record<"en" | "nl", string>;
  /** Only amenities this exact vehicle has. */
  amenities: Amenity[];
  verified: {
    /** "draft": researched from published figures, not yet confirmed against the exact model the client runs. */
    status: "draft" | "verified";
    source: string;
    url: string;
    checkedOn: string;
    by: string;
    /** What to check before this can be marked verified. */
    caveat?: string;
  };
};

/** A car the booking form can show. Extra fields are filled for vehicles added in the admin. */
export type OfferedVehicle = {
  key: string;
  name: string;
  images?: string[];
  seats?: number | null;
  bags?: number | null;
  /** Public hourly rate in euro cents. Absent for a car on the printed rate card. */
  rates?: { weekday: number; saturday: number; sunday: number } | null;
};

export type FleetVehicle = {
  key: string;
  name: string;
  /**
   * Up to eight photographs, first is the cover. Files live in /public. While only one exists the
   * gallery shows no arrows. Order is exterior (front, side, rear), then rear seating, then cockpit.
   * NOTE: the current photographs are AI-generated. Replace with real photographs as they arrive
   * (16:9, at least 1600px wide, same all-black styling), under a new filename: /assets is cached by
   * browsers for 7 days, so overwriting a file in place would keep showing the old photo. The `-gallery-N` files came from the client's
   * Drive folder on 14 Oct 2026 (PNG, 1672x941) and were resized to 1600px JPEG.
   */
  images: string[];
  /** What the client has told us the vehicle is. Decides whether an electric-range answer is offered (not for "ice"); no badge is shown. Confirm per model before launch. */
  drivetrain: "bev" | "phev" | "ice";
  specs?: VehicleSpecs;
};

export const MAX_GALLERY_IMAGES = 8;

// Amenities below are limited to what every vehicle here has: black executive leather (the fleet standard), climate
// control, and the complimentary refreshments the service provides. In-car screens and entertainment differ by trim and
// are not listed until each vehicle's configuration is confirmed (the client asked that nothing unavailable is advertised).
const COMMON_AMENITIES: Amenity[] = ["executive_seating", "climate_control", "refreshments"];

// ALL SPECS BELOW ARE DRAFTS (status: "draft"). They come from published figures found on 14 Oct 2026, are not confirmed
// against the exact models the client operates, and some sources disagree. Confirm each with the client, then set
// status to "verified" and add the manufacturer's own page as the source.
export const FLEET: FleetVehicle[] = [
  {
    key: "mercedes_vle_300",
    name: "Mercedes-Benz VLE 300",
    images: [
      "/assets/fleet-mercedes-vle-300-v2.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-2.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-3.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-4.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-5.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-6.jpg",
      "/assets/fleet-mercedes-vle-300-gallery-7.jpg",
    ],
    drivetrain: "bev",
    specs: {
      passengers: 6,
      rangeKm: 700,
      rangeStandard: "WLTP",
      luggage: {
        en: "Up to 795 litres with all seats in place (4,078 litres with the rear seats folded).",
        nl: "Tot 795 liter met alle zetels op hun plaats (4.078 liter met de achterbank neergeklapt).",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "Mercedes-Benz factsheet and ADAC catalogue",
        url: "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/mercedes-benz/vle/1generation/350749/",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat: "Sold as 6- and 7-seat versions: confirm which configuration the fleet vehicle is. Range is stated as 'above 700 km' WLTP.",
      },
    },
  },
  {
    // The key stays "audi" (stored on every booking made so far); the model is the e-tron GT, as the client lists it on
    // the Corporate Partner form.
    key: "audi",
    name: "Audi e-tron GT",
    images: [
      "/assets/fleet-audi-v2.jpg",
      "/assets/fleet-audi-gallery-2.jpg",
      "/assets/fleet-audi-gallery-3.jpg",
      "/assets/fleet-audi-gallery-4.jpg",
      "/assets/fleet-audi-gallery-5.jpg",
      "/assets/fleet-audi-gallery-6.jpg",
      "/assets/fleet-audi-gallery-7.jpg",
    ],
    drivetrain: "bev",
    specs: {
      passengers: 4,
      rangeKm: 609,
      rangeStandard: "WLTP",
      luggage: {
        en: "405 litres in the boot, plus about 80 litres in the front trunk.",
        nl: "405 liter in de kofferbak, plus ongeveer 80 liter in de voorste kofferbak.",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "Published e-tron GT figures (carsguide.com.au, 2025 e-tron GT S)",
        url: "https://www.carsguide.com.au/audi/e-tron-gt/2025",
        checkedOn: "2026-10-21",
        by: "Claude (research)",
        caveat:
          "Replaces the earlier draft, which described the A6 e-tron (the client lists this car as the e-tron GT, and a QA report asked for the model name). Range is for the S grade (up to 609 km WLTP); the RS grades are about 592-599 km and have a 350 L boot. Sources disagree on seats (4 in Audi's UK listing, 5 in Australian ones); 4 is used for a chauffeured trip. The photographs are AI-generated and show a saloon that is not clearly an e-tron GT: replace them. Confirm the grade the fleet car is, then mark verified.",
      },
    },
  },
  {
    key: "cadillac_escalade",
    name: "Cadillac Escalade IQ",
    images: [
      "/assets/fleet-cadillac-escalade-v2.jpg",
      "/assets/fleet-cadillac-escalade-gallery-2.jpg",
      "/assets/fleet-cadillac-escalade-gallery-3.jpg",
      "/assets/fleet-cadillac-escalade-gallery-4.jpg",
      "/assets/fleet-cadillac-escalade-gallery-5.jpg",
      "/assets/fleet-cadillac-escalade-gallery-6.jpg",
      "/assets/fleet-cadillac-escalade-gallery-7.jpg",
    ],
    drivetrain: "bev",
    specs: {
      passengers: 7,
      // 465 miles, Cadillac's US estimate for the Escalade IQ (1 mile = 1.609 km)
      rangeKm: 748,
      rangeStandard: "EPA",
      luggage: {
        en: "About 668 litres behind the third row, and about 345 litres more in the front trunk.",
        nl: "Ongeveer 668 liter achter de derde zetelrij en ongeveer 345 liter extra in de voorste kofferbak.",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "Escalade IQ key specifications supplied by the client (screenshot, 18 Oct 2026), cross-checked against press and dealer listings",
        url: "https://www.cadillac.com/electric/escalade-iq",
        checkedOn: "2026-10-18",
        by: "Claude (client-supplied figures)",
        caveat:
          "These are the standard-wheelbase Escalade IQ (224.3 in), not the longer IQL the earlier draft used (740 km, 686 L). The 465 mi range is the US estimate (EPA-style, reads higher than a European WLTP figure); Cadillac's own page quotes 460 mi, dealer listings 465. The luggage figures (23.6 cu ft behind the third row, 12.2 cu ft front trunk) come from press listings, not from the client's screenshot, which gives only the 131.3 cu ft maximum with the seats folded (119.1 + 12.2). Other figures supplied and not shown on the site: 205 kWh battery, up to 750 hp, 0–60 mph in about 4.7 s, up to 350 kW fast charging, dual-motor AWD. Dutch coverage notes the weight may need more than a standard B licence: check with RDW before it is offered. Confirm the exact variant the client runs, then mark verified.",
      },
    },
  },
  {
    key: "range_rover",
    name: "Range Rover EV",
    images: [
      "/assets/fleet-range-rover-v2.jpg",
      "/assets/fleet-range-rover-gallery-2.jpg",
      "/assets/fleet-range-rover-gallery-3.jpg",
      "/assets/fleet-range-rover-gallery-4.jpg",
      "/assets/fleet-range-rover-gallery-5.jpg",
      "/assets/fleet-range-rover-v3.png",
      "/assets/fleet-range-rover-gallery-6.jpg",
    ],
    drivetrain: "bev",
    specs: {
      passengers: 5,
      rangeKm: 611,
      rangeStandard: "WLTP",
      luggage: {
        en: "About 818 litres with the rear seats in place.",
        nl: "Ongeveer 818 liter met de achterzetels op hun plaats.",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "EVKX Range Rover Electric listing (work in progress)",
        url: "https://evkx.net/models/range_rover/range_rover_electric/range_rover_electric_ev550/specifications/",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat:
          "Range Rover Electric's launch was delayed and figures were still provisional. If the fleet car is a plug-in hybrid (e.g. P460e) the range answer is wrong. The 818 L luggage figure comes from the QA report of 19 Oct 2026 (published sources disagreed earlier: 733 L and 1,050 L): confirm it against the exact car.",
      },
    },
  },
  {
    key: "hongqi_e_hs9",
    name: "Hongqi E-HS9",
    images: [
      "/assets/fleet-hongqi-e-hs9-v2.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-2.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-3.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-4.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-5.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-6.jpg",
      "/assets/fleet-hongqi-e-hs9-gallery-7.jpg",
    ],
    drivetrain: "bev",
    specs: {
      passengers: 6,
      rangeKm: 465,
      rangeStandard: "WLTP",
      luggage: {
        en: "About 440 litres with the rear seats in place.",
        nl: "Ongeveer 440 liter met de achterzetels op hun plaats.",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "EVKX and ArenaEV (99 kWh E-HS9)",
        url: "https://evkx.net/models/hongqi/e-hs9/e-hs9_exclusive/specifications/",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat: "Several battery sizes (84/99/110 kWh, 396-515 km WLTP) and 5-, 6- and 7-seat layouts exist. Luggage comes from a single source.",
      },
    },
  },
];

/** What the booking form's vehicle box accepts: a specific vehicle, or "advise me". */
export const VEHICLE_CHOICES = [...VEHICLE_KEYS, "advise"] as const;
export type VehicleChoice = (typeof VEHICLE_CHOICES)[number];


// The ids a vehicle added by name in the admin's Vehicles page gets (its name as a slug) also resolve to the fleet vehicle.
// Matched on the slug (letters and digits, one underscore between), so "audi-e-tron-gt" and "audi_e_tron_gt" are the same.
const slug = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const ID_ALIASES: Record<string, VehicleKey> = {
  mercedes_benz_vle_300: "mercedes_vle_300",
  audi_e_tron_gt: "audi",
  audi_etron_gt: "audi",
  cadillac_escalade: "cadillac_escalade",
  cadillac_escalade_iq: "cadillac_escalade",
  range_rover: "range_rover",
  range_rover_ev: "range_rover",
  hongqi_ehs9: "hongqi_e_hs9",
  hongqi_e_hs9: "hongqi_e_hs9",
};

export function normalizeVehicleKey(key: string | null | undefined): VehicleKey | undefined {
  if (!key) return undefined;
  if ((VEHICLE_KEYS as readonly string[]).includes(key)) {
    return key as VehicleKey;
  }
  const s = slug(key);
  return (VEHICLE_KEYS as readonly string[]).includes(s) ? (s as VehicleKey) : ID_ALIASES[s];
}

export const vehicleByKey = (key: string | null | undefined) => {
  const normalized = normalizeVehicleKey(key) ?? key;
  return FLEET.find((v) => v.key === normalized);
};

/**
 * Large suitcases the car can take with the seats in place, about 180 litres each.
 * The boot and the front trunk both count. A figure in parentheses is the folded-seat volume, so it is left out.
 */
export function bagCapacity(vehicle: FleetVehicle): number {
  const text = (vehicle.specs?.luggage?.en ?? "").replace(/\([^)]*\)/g, " ");
  const litres = [...text.matchAll(/(\d[\d,]*)/g)].reduce((sum, match) => sum + Number(match[1].replace(/,/g, "")), 0);
  if (!litres) return vehicle.specs?.passengers ?? 1;
  return Math.max(1, Math.round(litres / 180));
}

/** The most suitcases any one car in the fleet can take. */
export const MAX_BAG_CAPACITY = Math.max(...FLEET.map(bagCapacity));

export const fleetSeats = (vehicle: FleetVehicle) => vehicle.specs?.passengers ?? 0;

/** The biggest car still on offer. Order in the fleet breaks a tie. */
export function largestOffered(offered: readonly { key: string }[]): FleetVehicle | undefined {
  const available = offered.map((v) => vehicleByKey(v.key)).filter((v): v is FleetVehicle => v != null && fleetSeats(v) > 0);
  return available.sort((a, b) => fleetSeats(b) - fleetSeats(a) || FLEET.indexOf(a) - FLEET.indexOf(b))[0];
}

export type ConvoyPlan = {
  /** How many of `vehicle` travel together. */
  count: number;
  vehicle: FleetVehicle;
};

/** How many of one model a visitor can pick (5, the client, 8 Nov 2026), and how many cars a suggested convoy uses. */
export const MAX_CARS = 5;

/**
 * The tightest set of cars for a party that does not fit in one.
 * Smaller cars win when they cover the party with fewer empty seats: eight guests use two 4-seaters, not two 7-seaters.
 * At most `MAX_CARS` are used. A party that fits in one car returns nothing.
 * A party that cannot be covered in `MAX_CARS` cars gets the set that seats the most, and the team arranges the rest.
 */
export function fitConvoy(offered: readonly { key: string }[], pax: number): FleetPick[] | undefined {
  const models: FleetVehicle[] = [];
  const seen = new Set<string>();
  for (const item of offered) {
    const vehicle = vehicleByKey(item.key);
    if (!vehicle || seen.has(vehicle.key) || fleetSeats(vehicle) <= 0) continue;
    seen.add(vehicle.key);
    models.push(vehicle);
  }
  if (models.length === 0 || pax <= Math.max(...models.map(fleetSeats))) return undefined;

  type Score = { covers: boolean; waste: number; seats: number; desc: number[]; count: number; order: number };
  let best: { picks: FleetPick[]; score: Score } | undefined;
  const counts = new Array<number>(models.length).fill(0);

  const better = (a: Score, b: Score) => {
    if (a.covers !== b.covers) return a.covers;
    if (!a.covers) return a.seats !== b.seats ? a.seats > b.seats : a.count < b.count;
    if (a.waste !== b.waste) return a.waste < b.waste;
    const length = Math.max(a.desc.length, b.desc.length);
    for (let i = 0; i < length; i++) {
      const left = a.desc[i] ?? 0;
      const right = b.desc[i] ?? 0;
      if (left !== right) return left < right;
    }
    return a.count !== b.count ? a.count < b.count : a.order < b.order;
  };

  const consider = () => {
    const picks: FleetPick[] = [];
    const desc: number[] = [];
    let seats = 0;
    let count = 0;
    let order = 0;
    counts.forEach((n, index) => {
      if (n <= 0) return;
      const model = models[index];
      picks.push({ key: model.key, count: n });
      seats += fleetSeats(model) * n;
      count += n;
      order += FLEET.indexOf(model) * n;
      for (let i = 0; i < n; i++) desc.push(fleetSeats(model));
    });
    if (count < 2) return;
    desc.sort((a, b) => b - a);
    const covers = seats >= pax;
    const score: Score = { covers, waste: covers ? seats - pax : Number.POSITIVE_INFINITY, seats, desc, count, order };
    if (!best || better(score, best.score)) best = { picks, score };
  };

  const walk = (index: number, left: number) => {
    if (index === models.length) {
      consider();
      return;
    }
    for (let n = 0; n <= left; n++) {
      counts[index] = n;
      walk(index + 1, left - n);
    }
  };
  walk(0, MAX_CARS);
  return best?.picks;
}

/**
 * When the party does not fit in the biggest car on offer, how many cars travel together.
 * The model is the first of the tight fit (`fitConvoy`). A party that fits in one car returns nothing.
 */
export function convoyFor(offered: readonly { key: string }[], pax: number, _preferred?: string | null): ConvoyPlan | undefined {
  const picks = fitConvoy(offered, pax);
  const lead = picks ? vehicleByKey(picks[0]?.key) : undefined;
  if (!picks || !lead) return undefined;
  return { count: picks.reduce((n, pick) => n + pick.count, 0), vehicle: lead };
}

/** Most seats any one car in the fleet has. A larger party needs more than one car. */
export const LARGEST_CAR_SEATS = Math.max(...FLEET.map((v) => v.specs?.passengers ?? 0));

export type FleetPick = { key: string; count: number };

/** Cars a form or a stored quote named, with a quantity of at least one. Each model is kept up to `MAX_CARS`; a mix of models is kept. */
export function fleetPicks(raw: unknown): FleetPick[] {
  if (!Array.isArray(raw)) return [];
  const picks: FleetPick[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rawKey = "key" in item ? String((item as { key: unknown }).key) : "";
    const key = normalizeVehicleKey(rawKey) ?? rawKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!/^[a-z0-9_]{1,64}$/.test(key)) continue;
    const count = Number("count" in item ? (item as { count: unknown }).count : 0);
    if (!key || !Number.isInteger(count) || count < 1) continue;
    const n = Math.min(MAX_CARS, count);
    const existing = picks.find((pick) => pick.key === key);
    if (existing) existing.count = Math.min(MAX_CARS, existing.count + n);
    else if (picks.length < 8) picks.push({ key, count: n });
  }
  return picks;
}

const pickLine = (picks: FleetPick[]) => picks.map((p) => `${p.count} × ${vehicleByKey(p.key)?.name ?? p.key}`).join(", ");

/** "2 × Audi e-tron GT", a mix such as "1 × Audi e-tron GT, 1 × Cadillac Escalade IQ", or nothing for a single car. */
export function convoyTitle(input: { passengers?: number | null; vehicle?: string | null; vehicles?: unknown }): string | null {
  const picks = fleetPicks(input.vehicles);
  if (picks.length > 1 || (picks[0] && picks[0].count > 1)) return pickLine(picks);
  if (picks.length === 1) return null;
  const plan = fitConvoy(FLEET, input.passengers ?? 0);
  return plan ? pickLine(plan) : null;
}

const seatsOf = (picks: FleetPick[]) => picks.reduce((n, pick) => n + (vehicleByKey(pick.key)?.specs?.passengers ?? 0) * pick.count, 0);

/** English note for the dispatch team, and how many cars the fare extras are multiplied by. */
export function convoyAllocation(input: { passengers?: number | null; vehicle?: string | null }): { vehicleCount: number; vehicles: FleetPick[] | null; internalNotes: string | null } {
  const passengers = input.passengers ?? 0;
  const plan = fitConvoy(FLEET, passengers);
  if (!plan) return { vehicleCount: 1, vehicles: null, internalNotes: null };
  const seats = seatsOf(plan);
  const covered = seats >= passengers ? "" : ` These cars seat ${seats}. The team will arrange the remaining seats.`;
  return {
    vehicleCount: plan.reduce((n, pick) => n + pick.count, 0),
    vehicles: plan,
    internalNotes: `Multi-vehicle convoy: ${pickLine(plan)} for ${passengers} passengers.${covered}`,
  };
}

/**
 * What to store for the cars on a quote. A list the visitor chose is kept, even when it does not seat everyone.
 * With no list, the tightest fit of up to `MAX_CARS` cars is planned. Any seats still missing are left for the team.
 */
export function allocationFor(input: { passengers?: number | null; vehicle?: string | null; vehicles?: unknown }): {
  vehicle?: string;
  vehicleCount: number;
  vehicles: FleetPick[] | null;
  internalNotes: string | null;
} {
  const picks = fleetPicks(input.vehicles);
  const passengers = input.passengers ?? 0;
  if (picks.length > 0) {
    const seats = seatsOf(picks);
    const vehicleCount = picks.reduce((n, p) => n + p.count, 0);
    const chosen = vehicleCount > 1 ? `Selected vehicles: ${pickLine(picks)} for ${passengers} passengers.` : null;
    const rest = seats < passengers ? `Chosen cars seat ${seats}. The team will arrange the remaining seats for ${passengers} passengers.` : null;
    return {
      vehicle: picks[0].key,
      vehicleCount,
      vehicles: picks,
      internalNotes: [chosen, rest].filter(Boolean).join(" ") || null,
    };
  }
  return convoyAllocation({ passengers, vehicle: input.vehicle });
}

/**
 * The car to book when the visitor asks us to choose. It has to be one of the cars still on offer (not switched off,
 * not already booked), it has to seat the party, and it has to take the suitcases. The smallest that still fits wins,
 * so two guests are not put in the largest car.
 */
export function suggestVehicle(offered: readonly { key: string }[], need: { pax: number; bags: number }): FleetVehicle | undefined {
  const available = offered.map((v) => vehicleByKey(v.key)).filter((v): v is FleetVehicle => Boolean(v));
  if (available.length === 0) return undefined;
  const seats = (v: FleetVehicle) => v.specs?.passengers ?? 0;
  const seating = available.filter((v) => seats(v) >= need.pax);
  if (seating.length === 0) return undefined;
  const roomy = seating.filter((v) => bagCapacity(v) >= need.bags);
  const candidates = roomy.length > 0 ? roomy : [...seating].sort((a, b) => bagCapacity(b) - bagCapacity(a)).slice(0, 1);
  return [...candidates].sort((a, b) => seats(a) - seats(b) || bagCapacity(b) - bagCapacity(a) || FLEET.indexOf(a) - FLEET.indexOf(b))[0];
}
