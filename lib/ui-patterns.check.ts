// @ts-nocheck -- dev-only check script, run directly with node
// Quick self-check for the UI pattern picker. Run with:
//   node --experimental-strip-types lib/ui-patterns.check.ts
import assert from "node:assert";
import { PATTERNS, pickPatterns } from "./ui-patterns.ts";

const top = (...args) => pickPatterns(...args)[0]?.name;

// The screen name matters most.
assert.strictEqual(top("Cart", ["Order items", "Total"], "food delivery"), "Cart");
assert.strictEqual(top("Checkout", ["Address", "Pay now"]), "Checkout / payment");
assert.strictEqual(top("Profile", ["Settings", "Log out"]), "Profile");
assert.strictEqual(top("Sign up", ["Email", "Password"]), "Sign in / sign up");
// Labels help when the name is vague.
assert.strictEqual(top("Screen 2", ["Your balance", "Send money", "Transactions"], "a banking app"), "Wallet / finance home");
// At most 3, nothing for gibberish.
assert.ok(pickPatterns("Home", ["Search", "Categories", "Popular near you"], "food").length <= 3);
assert.deepStrictEqual(pickPatterns("Qzx", ["vvv"], ""), []);
// Every pattern is complete.
assert.ok(PATTERNS.every((p) => p.name && p.keywords.length && p.layout && p.details));

// Weak side-matches are dropped ("promo code" must not pull in a paywall).
assert.ok(!pickPatterns("Cart", ["Promo code", "Total"], "food").some((p) => p.name.startsWith("Subscription")));
// Keywords match whole words / word starts: "me" isn't found inside "home".
assert.ok(!pickPatterns("Home", ["Search", "Popular near you"], "food").some((p) => p.name === "Profile"));
console.log("ui-patterns checks passed");
