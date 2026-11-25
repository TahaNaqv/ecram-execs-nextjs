import assert from "node:assert/strict";
import { evaluateShift, MIN_BREAK_BLOCK_MS, SHIFT_CAP_MS } from "../lib/drivers/shifts.ts";

const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 25, hour, minute);

const sixHours = evaluateShift({
  start: at(8),
  end: at(14),
  now: at(14),
  jobs: [
    { start: at(8), end: at(10) },
    { start: at(10, 15), end: at(12) },
    { start: at(12, 15), end: at(14) },
  ],
});

assert.equal(sixHours.workedMs, 6 * 3_600_000);
assert.equal(sixHours.blocks.length, 2);
assert.ok(sixHours.blocks.every((block) => block.end - block.start >= MIN_BREAK_BLOCK_MS));
assert.equal(sixHours.breakMs, 30 * 60_000);
assert.equal(sixHours.requiredMs, 30 * 60_000);
assert.equal(sixHours.compliance, "green");

const shortGap = evaluateShift({
  start: at(8),
  end: at(14),
  now: at(14),
  jobs: [
    { start: at(8), end: at(11) },
    { start: at(11, 14), end: at(14) },
  ],
});
assert.equal(shortGap.breakMs, 0);
assert.equal(shortGap.compliance, "red");

const waiting = evaluateShift({
  start: at(8),
  end: at(14),
  now: at(14),
  jobs: [
    { start: at(8), end: at(10) },
    { start: at(10), end: at(11, 30) },
    { start: at(12), end: at(14) },
  ],
});
assert.equal(waiting.blocks.length, 1);
assert.equal(waiting.breakMs, 30 * 60_000);
assert.equal(waiting.compliance, "green");

const overTen = evaluateShift({
  start: at(6),
  end: at(17),
  now: at(17),
  jobs: [
    { start: at(6), end: at(9) },
    { start: at(9, 15), end: at(12) },
    { start: at(12, 15), end: at(15) },
    { start: at(15, 15), end: at(17) },
  ],
});
assert.equal(overTen.workedMs, SHIFT_CAP_MS);
assert.equal(overTen.autoClosed, true);
assert.equal(overTen.requiredMs, 45 * 60_000);
assert.equal(overTen.breakMs, 45 * 60_000);
assert.equal(overTen.compliance, "green");

const manualOnly = evaluateShift({
  start: at(8),
  end: at(14),
  now: at(14),
  jobs: [{ start: at(8), end: at(14) }],
  manualBreaks: [{ start: at(11), end: at(11, 30) }],
});
assert.equal(manualOnly.breakMs, 30 * 60_000);
assert.equal(manualOnly.compliance, "green");

console.log("driver shift compliance checks passed");
