import type { Sql } from "postgres";

/** Fleet id for the Mercedes-Benz eSprinter 420 RWD PRO. Matches the printed rate card key. */
export const ESPRINTER_ID = "mercedes_esprinter";

const IMAGES = [
  "/assets/Sprinter_van_studio_render_0f3fd8b1.jpg",
  "/assets/Sprinter_van_studio_render_5ce5b996.jpg",
  "/assets/Sprinter_van_studio_render_715456cc.jpg",
  "/assets/Black_Sprinter_van_studio_render_00dc9925.jpg",
  "/assets/Black_high-roof_Sprinter_van_022d1a11.jpg",
  "/assets/Luxury_Sprinter_van_interior_render_aeb794b0.jpg",
];

/**
 * Registers the eSprinter as available, with the public hourly prices including 9% VAT.
 * Quotes use the net rates in lib/pricing/rates.ts. Safe to run again: the same id is updated.
 */
export async function seedEsprinter(sql: Sql): Promise<void> {
  await sql`
    insert into vehicles (
      id, name, color, ev_range_km, battery_soc, status, ilt_permit_status, images, seats,
      rate_weekday, rate_saturday, rate_sunday, listed
    )
    values (
      ${ESPRINTER_ID},
      ${"Mercedes-Benz eSprinter 420 RWD PRO"},
      ${"Black"},
      ${440},
      ${85},
      ${"available"},
      ${"Valid"},
      ${sql.json(IMAGES)},
      ${16},
      ${16500},
      ${18500},
      ${19500},
      ${true}
    )
    on conflict (id) do update set
      name = excluded.name,
      color = excluded.color,
      ev_range_km = excluded.ev_range_km,
      status = excluded.status,
      images = excluded.images,
      seats = excluded.seats,
      rate_weekday = excluded.rate_weekday,
      rate_saturday = excluded.rate_saturday,
      rate_sunday = excluded.rate_sunday,
      listed = excluded.listed,
      updated_at = now()
  `;

  await sql`
    insert into vehicle_financials (vehicle_id, battery_capacity_kwh)
    values (${ESPRINTER_ID}, ${"113.00"})
    on conflict (vehicle_id) do update set
      battery_capacity_kwh = excluded.battery_capacity_kwh,
      updated_at = now()
  `;
}
