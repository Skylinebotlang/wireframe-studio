// @ts-nocheck -- dev-only check script, run directly with node
// Quick self-check for the rate-limit rules. Run with:
//   node --experimental-strip-types lib/rate-limit.check.ts
import assert from "node:assert";
import { decide, DAILY_RUNS } from "./rate-limit.ts";

const day = "2026-10-12";
const noon = Date.parse(`${day}T12:00:00Z`);
const fresh = { lastRunAt: 0, day: "", runs: 0 };

// First run passes and counts.
const first = decide(fresh, noon, true);
assert.ok(first.ok && first.next.runs === 1 && first.next.day === day);

// Within 10 seconds: blocked, says how long to wait.
const soon = decide({ lastRunAt: noon, day, runs: 1 }, noon + 3000, true);
assert.ok(!soon.ok && soon.error.includes("7 seconds"));

// After 10 seconds: allowed.
assert.ok(decide({ lastRunAt: noon, day, runs: 1 }, noon + 10_000, true).ok);

// Daily cap on the built-in key, but not on a person's own key.
const full = { lastRunAt: 0, day, runs: DAILY_RUNS };
assert.ok(!decide(full, noon, true).ok);
const own = decide(full, noon, false);
assert.ok(own.ok && own.next.runs === DAILY_RUNS);

// A new UTC day resets the count.
const tomorrow = decide(full, Date.parse("2026-10-13T00:00:01Z"), true);
assert.ok(tomorrow.ok && tomorrow.next.runs === 1);

// Design calls: no cooldown, but they still count against the day.
const design = decide({ lastRunAt: noon, day, runs: 1 }, noon + 1, true, 0);
assert.ok(design.ok && design.next.runs === 2);

console.log("rate-limit checks passed");
