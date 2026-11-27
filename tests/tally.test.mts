import assert from "node:assert/strict";
import { modelTally, tallyKey } from "../lib/fleet/tally.ts";

const vle = (id: string, status = "available") => ({ id, name: "Mercedes-Benz VLE 300", modelKey: "mercedes_vle_300", status });

// Two VLE 300s registered: 2×
assert.deepEqual(modelTally([vle("vle-a"), vle("vle-b")]), [{ key: "mercedes_vle_300", name: "Mercedes-Benz VLE 300", units: 2, active: 2 }]);

// A third one added: 3×
assert.equal(modelTally([vle("vle-a"), vle("vle-b"), vle("vle-c")])[0].units, 3);

// One switched off: still 3 registered, 2 on
assert.deepEqual(modelTally([vle("vle-a"), vle("vle-b", "unavailable"), vle("vle-c")])[0], { key: "mercedes_vle_300", name: "Mercedes-Benz VLE 300", units: 3, active: 2 });

// A car added before models existed counts by its id; a car of its own counts alone, under its name
const rows = [
  { id: "ford-escort", name: "Ford Escort", modelKey: null, status: "available" },
  { id: "audi", name: "Audi e-tron GT", status: "available" },
  vle("vle-a"),
  { id: "mercedes-benz-vle-300", name: "VLE (old record)", status: "available" },
];
const tally = modelTally(rows);
assert.deepEqual(
  tally.map((entry) => [entry.key, entry.units]),
  [
    ["mercedes_vle_300", 2], // the fleet's own order first
    ["audi", 1],
    ["car:ford-escort", 1], // then cars of their own
  ],
);
assert.equal(tally[0].name, "Mercedes-Benz VLE 300"); // the model's printed name, not the old record's
assert.equal(tallyKey(rows[0]), "car:ford-escort");

// The dashboard's rows carry `available` instead of `status`
assert.equal(modelTally([{ id: "x", name: "X", modelKey: "audi", available: false }])[0].active, 0);

assert.deepEqual(modelTally([]), []);
console.log("tally: ok");
