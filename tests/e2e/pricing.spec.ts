import { expect, test } from "@playwright/test";
import { carsToPrice } from "../../lib/pricing/booking";
import { billedHours, dayKind, hourlyRate, priceBooking } from "../../lib/pricing/rates";

// The client's rate card (November 2026): per car per hour, before the €12.50 service fee and 9% VAT, at least 2 hours.
// 2027-06-14 is a Monday, 2027-06-19 a Saturday, 2027-06-20 a Sunday.

test("the rate card's columns follow the day of the pick-up, in either wall-clock format", () => {
  expect(dayKind("2027-06-14T08:30")).toBe("weekday");
  expect(dayKind("2027-06-18 23:59:00")).toBe("weekday");
  expect(dayKind("2027-06-19T00:00")).toBe("saturday");
  expect(dayKind("2027-06-20 10:00:00")).toBe("sunday");
  expect(dayKind("soon")).toBeNull();
});

test("every car has the rate the card gives it", () => {
  for (const key of ["mercedes_vle_300", "audi", "hongqi_e_hs9"]) {
    expect([hourlyRate(key, "corporate", "weekday"), hourlyRate(key, "corporate", "saturday"), hourlyRate(key, "corporate", "sunday")]).toEqual([7700, 9700, 11600]);
    expect([hourlyRate(key, "public", "weekday"), hourlyRate(key, "public", "saturday"), hourlyRate(key, "public", "sunday")]).toEqual([8400, 10500, 12600]);
  }
  for (const key of ["range_rover", "cadillac_escalade"]) {
    expect([hourlyRate(key, "corporate", "weekday"), hourlyRate(key, "corporate", "saturday"), hourlyRate(key, "corporate", "sunday")]).toEqual([10100, 12700, 15200]);
    expect([hourlyRate(key, "public", "weekday"), hourlyRate(key, "public", "saturday"), hourlyRate(key, "public", "sunday")]).toEqual([11700, 14700, 17600]);
  }
  // A car named as the admin's Vehicles page names it is the same car
  expect(hourlyRate("Audi e-tron GT", "public", "weekday")).toBe(8400);
  expect(hourlyRate("a bicycle", "public", "weekday")).toBeNull();
});

test("a transfer is billed for its drive and waits, to the half hour, and never under two hours", () => {
  expect(billedHours({ driveSeconds: 40 * 60 })).toBe(2);
  expect(billedHours({ driveSeconds: 121 * 60 })).toBe(2.5);
  expect(billedHours({ driveSeconds: 100 * 60, waitMinutes: 30 })).toBe(2.5);
  expect(billedHours({ driveSeconds: 150 * 60 })).toBe(2.5);
  expect(billedHours({ hours: 5 })).toBe(5);
  // Not timed: nothing to bill on yet
  expect(billedHours({ driveSeconds: null })).toBeNull();
});

test("a public weekday transfer: rides, service fee and 9% VAT", () => {
  const price = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:30", driveSeconds: 45 * 60, cars: [{ key: "audi", count: 1 }] })!;
  // 2 hours × €84 = €168, + €12.50 = €180.50, + 9% = €196.75 (VAT added per line: €183.12 + €13.63)
  expect(price.rides).toBe(16800);
  expect(price.fee).toBe(1250);
  expect(price.total).toBe(18312 + 1363);
  expect(price.vat).toBe(price.total - 16800 - 1250);
  expect(price.exact).toBe(true);
});

test("corporate, a mix of cars, and a return on a Sunday priced at Sunday's rate", () => {
  const price = priceBooking({
    segment: "corporate",
    pickupAt: "2027-06-19T09:00",
    returnAt: "2027-06-20T18:00",
    driveSeconds: 150 * 60,
    cars: [{ key: "mercedes_vle_300", count: 2 }, { key: "range_rover", count: 1 }],
  })!;
  expect(price.legs.map((l) => [l.day, l.hours])).toEqual([["saturday", 2.5], ["sunday", 2.5]]);
  // Saturday: 2 × 2.5 × €97 + 2.5 × €127; Sunday: 2 × 2.5 × €116 + 2.5 × €152
  expect(price.rides).toBe(48500 + 31750 + 58000 + 38000);
  expect(price.legs).toHaveLength(2);
});

test("an hourly booking is billed for its hours; an untimed transfer or a suggested car is a 'from' price", () => {
  const hourly = priceBooking({ segment: "public", pickupAt: "2027-06-20T10:00", hours: 4, cars: [{ key: "cadillac_escalade", count: 1 }] })!;
  expect(hourly.rides).toBe(4 * 17600);
  expect(hourly.exact).toBe(true);

  const untimed = priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", driveSeconds: null, cars: [{ key: "audi", count: 1 }] })!;
  expect(untimed.rides).toBe(2 * 8400);
  expect(untimed.exact).toBe(false);

  const { cars, suggested } = carsToPrice({ vehicle: "advise", passengers: 2, luggage: 1 });
  expect(suggested).toBe(true);
  expect(cars).toHaveLength(1);
  expect(priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", driveSeconds: 3600, cars, suggested })!.exact).toBe(false);

  // No car the card knows, or no date: no price at all
  expect(priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", hours: 2, cars: [] })).toBeNull();
  expect(priceBooking({ segment: "public", pickupAt: "", hours: 2, cars: [{ key: "audi", count: 1 }] })).toBeNull();
});

test("the cars priced are the ones chosen, else the car or the set of cars we would suggest", () => {
  expect(carsToPrice({ vehicles: [{ key: "audi", count: 2 }], vehicle: "audi", passengers: 6 })).toEqual({ cars: [{ key: "audi", count: 2 }], suggested: false });
  expect(carsToPrice({ vehicle: "range_rover", passengers: 2 })).toEqual({ cars: [{ key: "range_rover", count: 1 }], suggested: false });
  const large = carsToPrice({ vehicle: "advise", passengers: 12 });
  expect(large.suggested).toBe(true);
  expect(large.cars.reduce((n, c) => n + c.count, 0)).toBeGreaterThan(1);
});
