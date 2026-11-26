import assert from "node:assert/strict";
import { anniversary, commissionBasisPoints, formatRate, nextRateChange, tenureYear } from "../lib/admin/commission.ts";

const start = "2026-11-27";
assert.equal(commissionBasisPoints(start, "2026-11-26"), 0); // before the start date
assert.equal(commissionBasisPoints(start, "2026-11-27"), 250); // year 1 from the start date itself
assert.equal(commissionBasisPoints(start, "2027-11-26"), 250);
assert.equal(commissionBasisPoints(start, "2027-11-27"), 200); // year 2 on the first anniversary
assert.equal(commissionBasisPoints(start, "2028-11-27"), 150);
assert.equal(commissionBasisPoints(start, "2029-11-27"), 100);
assert.equal(commissionBasisPoints(start, "2030-11-27"), 50); // year 5
assert.equal(commissionBasisPoints(start, "2040-01-01"), 50); // locked at 0.5%
assert.equal(tenureYear(start, "2030-11-26"), 4);

// A 29 February start steps on 28 February in other years
assert.equal(anniversary("2028-02-29", 1), "2029-02-28");
assert.equal(commissionBasisPoints("2028-02-29", "2029-02-27"), 250);
assert.equal(commissionBasisPoints("2028-02-29", "2029-02-28"), 200);

assert.deepEqual(nextRateChange(start, "2027-03-01"), { on: "2027-11-27", basisPoints: 200 });
assert.deepEqual(nextRateChange(start, "2026-01-01"), { on: start, basisPoints: 250 });
assert.equal(nextRateChange(start, "2031-01-01"), null);

assert.equal(formatRate(250), "2.5%");
assert.equal(formatRate(200), "2%");
assert.equal(formatRate(50), "0.5%");
console.log("commission schedule: ok");
