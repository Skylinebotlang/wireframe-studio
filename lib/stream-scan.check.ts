// @ts-nocheck -- dev-only check script, run directly with node
// Quick self-check for the partial-JSON scanner. Run with:
//   node --experimental-strip-types lib/stream-scan.check.ts
import assert from "node:assert";
import { scanPartial } from "./stream-scan.ts";

const full = JSON.stringify({
  action: "update",
  question: "",
  conflicts: [{ noteIds: ["a", "b"], summary: "Brackets ] and } in text" }],
  resolution: 'Kept "both" ideas',
  screens: [
    { name: "Home", components: [{ type: "header", label: "Hi {there}", notes: "" }] },
    { name: "Profile", components: [{ type: "text", label: "x", notes: "" }] },
  ],
});

// Nothing known at the very start.
let s = scanPartial(full.slice(0, 5));
assert.deepStrictEqual(s, { action: undefined, clashes: undefined, merged: false, screens: [] });

// Cut in the middle of the second screen: one screen ready, everything before it known.
const cut = full.indexOf('"Profile"');
s = scanPartial(full.slice(0, cut));
assert.strictEqual(s.action, "update");
assert.strictEqual(s.clashes, 1);
assert.strictEqual(s.merged, true);
assert.strictEqual(s.screens.length, 1);
assert.strictEqual(s.screens[0].components[0].label, "Hi {there}");

// Cut inside the resolution text: not merged yet.
s = scanPartial(full.slice(0, full.indexOf("both")));
assert.strictEqual(s.merged, false);
assert.strictEqual(s.clashes, 1);

// Whole answer: both screens.
assert.strictEqual(scanPartial(full).screens.length, 2);

console.log("stream-scan checks passed");
