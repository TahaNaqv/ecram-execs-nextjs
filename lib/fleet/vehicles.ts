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
  /** The test cycle the figure comes from, so ranges are comparable. */
  rangeStandard: "WLTP";
  /** Free-text per language: how many suitcases, of what size. */
  luggage: Record<"en" | "nl", string>;
  /** Only amenities this exact vehicle has. */
  amenities: Amenity[];
  verified: { source: string; url: string; checkedOn: string; by: string };
};

export type FleetVehicle = {
  key: VehicleKey;
  name: string;
  /**
   * Up to eight photographs, first is the cover. Files live in /public. While only one exists the
   * gallery shows no arrows.
   * NOTE: the current photographs are AI-generated. Replace with real photographs as they arrive
   * (16:9, at least 1600px wide, same all-black styling).
   */
  images: string[];
  /** What the client has told us the vehicle is, shown as the badge. Confirm per model before launch. */
  drivetrain: "bev" | "phev" | "ice";
  specs?: VehicleSpecs;
};

export const MAX_GALLERY_IMAGES = 8;

export const FLEET: FleetVehicle[] = [
  { key: "mercedes_vle_300", name: "Mercedes-Benz VLE 300", images: ["/assets/fleet-mercedes-vle-300-v2.jpg"], drivetrain: "bev" },
  { key: "audi", name: "Audi", images: ["/assets/fleet-audi-v2.jpg"], drivetrain: "bev" },
  { key: "cadillac_escalade", name: "Cadillac Escalade", images: ["/assets/fleet-cadillac-escalade-v2.jpg"], drivetrain: "bev" },
  { key: "range_rover", name: "Range Rover", images: ["/assets/fleet-range-rover-v2.jpg"], drivetrain: "bev" },
  { key: "hongqi_e_hs9", name: "Hongqi E-HS9", images: ["/assets/fleet-hongqi-e-hs9-v2.jpg"], drivetrain: "bev" },
];

/** What the booking form's vehicle box accepts: a specific vehicle, or "advise me". */
export const VEHICLE_CHOICES = [...VEHICLE_KEYS, "advise"] as const;
export type VehicleChoice = (typeof VEHICLE_CHOICES)[number];

export const vehicleByKey = (key: string | null | undefined) => FLEET.find((v) => v.key === key);
