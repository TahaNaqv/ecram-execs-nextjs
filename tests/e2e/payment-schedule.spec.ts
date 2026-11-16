import { expect, test } from "@playwright/test";
import { addMonths, balanceDueOn, feeWithVatCents, noticeOn, planFor, upfrontCents } from "../../lib/payments/schedule";

/**
 * The plan rules of 15 Nov 2026 (lib/payments/schedule.ts), at their edges. Pure: no page, no database.
 * A: 6 calendar months or more ahead (fee now, rest 30 days before, approved by itself); B: in between (fee now, rest
 * 30 days before, by hand); C: 30 days or less (everything now, by hand).
 */
test.describe("payment plan", () => {
  test("30 days or less is C, 31 days is B", () => {
    expect(planFor("2027-01-15T10:00", "2026-12-16")).toBe("C"); // 30 days
    expect(planFor("2027-01-16T10:00", "2026-12-16")).toBe("B"); // 31 days
    expect(planFor("2026-12-16T23:00", "2026-12-16")).toBe("C"); // today
  });

  test("exactly 6 calendar months ahead is A, a day less is B", () => {
    expect(planFor("2027-05-15T08:00", "2026-11-15")).toBe("A");
    expect(planFor("2027-05-14T08:00", "2026-11-15")).toBe("B");
  });

  test("month ends and leap years clamp to the month's last day", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(planFor("2027-02-28T09:00", "2026-08-31")).toBe("A");
    expect(planFor("2027-02-27T09:00", "2026-08-31")).toBe("B");
  });

  test("no date, no plan (a bespoke programme is quoted by hand)", () => {
    expect(planFor(null, "2026-11-15")).toBeNull();
  });

  test("the balance is due 30 days before the ride, the notice 5 days before that", () => {
    expect(balanceDueOn("B", "2027-03-01T08:00")).toBe("2027-01-30");
    expect(noticeOn("B", "2027-03-01T08:00")).toBe("2027-01-25");
    expect(balanceDueOn("A", "2027-03-01 08:00:00")).toBe("2027-01-30");
    expect(balanceDueOn("C", "2027-03-01T08:00")).toBeNull();
    expect(balanceDueOn(null, "2027-03-01T08:00")).toBeNull();
  });

  test("the fee at booking is €15.13; plan C pays everything; never more than the total", () => {
    const price = { fee: 1250, feeVat: 263 };
    expect(feeWithVatCents(price)).toBe(1513);
    expect(feeWithVatCents(null)).toBe(1513);
    expect(upfrontCents("A", 45752, price)).toBe(1513);
    expect(upfrontCents("B", 45752, price)).toBe(1513);
    expect(upfrontCents("C", 45752, price)).toBe(45752);
    expect(upfrontCents("B", 1000, price)).toBe(1000);
  });
});
