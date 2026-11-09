// @ts-nocheck -- dev-only check script, run directly with node
// Self-check for the sign-in limits and the failed sign-in log:
//   node --experimental-strip-types lib/server/auth-limit.check.ts
import assert from "node:assert/strict";
import { ALERT_AT, logFailure, maskEmail, note, tooMany } from "./auth-limit.ts";

const t0 = 1_000_000;
// 5 tries allowed in the window, the 6th is blocked, and the window slides.
for (let i = 0; i < 5; i++) {
  assert.equal(tooMany("k", 5, 60_000, t0 + i), false);
  note("k", t0 + i);
}
assert.equal(tooMany("k", 5, 60_000, t0 + 10), true);
assert.equal(tooMany("k", 5, 60_000, t0 + 60_010), false); // old tries expired
assert.equal(tooMany("other", 5, 60_000, t0), false); // keys don't mix

assert.equal(maskEmail("papi@gmail.com"), "pa***@gmail.com");
assert.equal(maskEmail("nonsense"), "***");

// The alert line fires once, exactly when the 5th failure for one email lands.
const errors = [];
const warns = [];
console.error = (m) => errors.push(m);
console.warn = (m) => warns.push(m);
for (let i = 0; i < ALERT_AT.email + 2; i++) {
  note("signin-fail:x@y.co", t0 + i);
  logFailure("signin", "1.2.3.4", "x@y.co", t0 + i);
}
assert.equal(warns.length, ALERT_AT.email + 2);
assert.ok(!warns.join("").includes("x@y.co")); // never the full address
assert.equal(errors.length, 1);
assert.ok(errors[0].startsWith("SECURITY ALERT"));
process.stdout.write("auth-limit: all checks passed\n");
