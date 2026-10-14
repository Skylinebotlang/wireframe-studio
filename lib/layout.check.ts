// @ts-nocheck -- dev-only check script, run directly with node
// Quick self-check for the phone layout. Run with:
//   node --experimental-strip-types lib/layout.check.ts
import assert from "node:assert";
import { layoutScreen, PAD, PHONE_MIN_H, PHONE_W } from "./layout.ts";

const inner = PHONE_W - PAD * 2;
const C = (type, label, columns) => ({ type, label, ...(columns ? { columns } : {}) });

// Old answers (no columns): everything full width, stacked.
let { boxes } = layoutScreen([C("header", "Hi"), C("button", "Go")]);
assert.ok(boxes.every((b) => b.w === inner && b.x === PAD));
assert.ok(boxes[1].y > boxes[0].y);

// Two buttons with columns 2: one row, side by side.
({ boxes } = layoutScreen([C("button", "Cancel", 2), C("button", "Save", 2)]));
assert.strictEqual(boxes[0].y, boxes[1].y);
assert.ok(boxes[1].x > boxes[0].x);
assert.ok(boxes[1].x + boxes[1].w <= PAD + inner + 0.001);

// Four cards with columns 2: a 2×2 grid (two rows).
({ boxes } = layoutScreen([1, 2, 3, 4].map((n) => C("card", `Card ${n}`, 2))));
assert.strictEqual(new Set(boxes.map((b) => b.y)).size, 2);
assert.strictEqual(new Set(boxes.map((b) => b.x)).size, 2);

// Three in a row, then a full-width box starts a new row.
({ boxes } = layoutScreen([C("button", "A", 3), C("button", "B", 3), C("button", "C", 3), C("text", "D")]));
assert.strictEqual(new Set(boxes.slice(0, 3).map((b) => b.y)).size, 1);
assert.ok(boxes[3].y > boxes[0].y && boxes[3].w === inner);

// Tab bar: split on "|", pinned to the bottom, even if listed first.
const { boxes: tb, height } = layoutScreen([C("tabbar", "Home | Search | Profile"), C("header", "Hi")]);
const tabs = tb.filter((b) => b.c.type === "tabbar");
assert.deepStrictEqual(tabs.map((t) => t.label), ["Home", "Search", "Profile"]);
assert.strictEqual(height, PHONE_MIN_H);
assert.ok(tabs.every((t) => t.y + t.h === height - PAD));
assert.ok(tb.find((b) => b.label === "Hi").y < tabs[0].y);

console.log("layout checks passed");
