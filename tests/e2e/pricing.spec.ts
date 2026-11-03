import { expect, test } from "@playwright/test";
import { carsToPrice } from "../../lib/pricing/booking";
import { billedHours, dayKind, hourlyRate, priceBooking, priceNet } from "../../lib/pricing/rates";

// The client's rate card (November 2026): per car per hour, in whole hours and at least 2; then 9% VAT on the rides,
// then a €12.50 service fee with 21% VAT on it (€2.63). 2027-06-14 is a Monday, 2027-06-19 a Saturday, 2027-06-20 a Sunday.

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

test("a transfer is billed in whole hours for its drive, never under two, and waiting is not charged", () => {
  // A 45-minute ride is two hours
  expect(billedHours({ driveSeconds: 45 * 60 })).toBe(2);
  expect(billedHours({ driveSeconds: 120 * 60 })).toBe(2);
  expect(billedHours({ driveSeconds: 121 * 60 })).toBe(3);
  expect(billedHours({ hours: 5 })).toBe(5);
  // Not timed: nothing to bill on yet
  expect(billedHours({ driveSeconds: null })).toBeNull();
});

test("a standard weekday ride: hours × rate, 9% VAT, then the €12.50 service fee with its 21% VAT", () => {
  const price = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:30", driveSeconds: 45 * 60, cars: [{ key: "audi", count: 1 }] })!;
  // 2 hours × €84 = €168, + 9% (€15.12) = €183.12, + €12.50 + 21% of it (€2.63) = €198.25
  expect(price.rides).toBe(16800);
  expect(price.vat).toBe(1512);
  expect(price.fee).toBe(1250);
  expect(price.feeVat).toBe(263);
  expect(price.total).toBe(19825);
  expect(priceNet(price)).toBe(16800 + 1250);
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
  expect(price.legs.map((l) => [l.day, l.hours])).toEqual([["saturday", 3], ["sunday", 3]]);
  // Saturday: 2 × 3 × €97 + 3 × €127; Sunday: 2 × 3 × €116 + 3 × €152
  const rides = 58200 + 38100 + 69600 + 45600;
  expect(price.rides).toBe(rides);
  expect(price.vat).toBe(Math.round(rides * 0.09));
  expect(price.total).toBe(rides + Math.round(rides * 0.09) + 1250 + 263);
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

  // A price stored before the fee carried VAT still reads correctly
  expect(priceNet({ ...hourly, feeVat: undefined, total: hourly.rides + hourly.vat + hourly.fee })).toBe(hourly.rides + hourly.fee);

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
