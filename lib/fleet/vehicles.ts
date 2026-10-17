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

export type FleetVehicle = {
  key: VehicleKey;
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
  /** What the client has told us the vehicle is, shown as the badge. Confirm per model before launch. */
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
    key: "audi",
    name: "Audi",
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
      passengers: 5,
      rangeKm: 612,
      rangeStandard: "WLTP",
      luggage: {
        en: "502 litres (1,330 litres with the rear seats folded).",
        nl: "502 liter (1.330 liter met de achterbank neergeklapt).",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "Driving Electric specification listing, Audi A6 e-tron",
        url: "https://www.drivingelectric.com/audi/a6-e-tron/prices-specs/106870/210kw-83kwh-sport-5dr-auto",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat: "The client only says 'Audi'. These figures assume the A6 e-tron (83 kWh); other batteries give up to ~700 km. Confirm the model and variant.",
      },
    },
  },
  {
    key: "cadillac_escalade",
    name: "Cadillac Escalade",
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
      rangeKm: 740,
      rangeStandard: "EPA",
      luggage: {
        en: "About 686 litres behind the third row.",
        nl: "Ongeveer 686 liter achter de derde zetelrij.",
      },
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "Cadillac Escalade IQL (cadillac.com) and Dutch coverage",
        url: "https://www.cadillac.com/electric/escalade-iql",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat:
          "Only the Escalade IQL is electric. The 740 km figure is the US EPA rating (no WLTP found), which reads higher than WLTP. Dutch coverage notes its weight (~4.7 t) may need more than a standard B licence: check with RDW before it is offered.",
      },
    },
  },
  {
    key: "range_rover",
    name: "Range Rover",
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
      // No luggage figure: published values conflict (733 L vs 1,050 L behind the second row).
      amenities: COMMON_AMENITIES,
      verified: {
        status: "draft",
        source: "EVKX Range Rover Electric listing (work in progress)",
        url: "https://evkx.net/models/range_rover/range_rover_electric/range_rover_electric_ev550/specifications/",
        checkedOn: "2026-10-14",
        by: "Claude (research)",
        caveat:
          "Range Rover Electric's launch was delayed and figures were still provisional. If the fleet car is a plug-in hybrid (e.g. P460e) the range and the '100% electric' badge are wrong. Luggage left out until Land Rover publishes it.",
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

export const vehicleByKey = (key: string | null | undefined) => FLEET.find((v) => v.key === key);
