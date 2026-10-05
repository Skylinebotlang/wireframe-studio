// @ts-nocheck -- dev-only check script, run directly with node
// Quick self-check for the answer validator. Run with:
//   node --experimental-strip-types lib/agent-schema.check.ts
import assert from "node:assert";
import { validateAgentResult } from "./agent-schema.ts";

const good = {
  conflicts: [{ noteIds: ["shape:a", "shape:b"], summary: "Summary on top vs minimal" }],
  resolution: "Kept a compact summary at the top.",
  screens: [{ name: "Home", components: [{ type: "header", label: "Hi", notes: "" }] }],
};

const ok = validateAgentResult(good);
assert.ok(ok.ok);
assert.deepStrictEqual(ok.ok && ok.result.screens[0].components[0], { type: "header", label: "Hi" });

assert.ok(!validateAgentResult(null).ok);
assert.ok(!validateAgentResult({ ...good, screens: [] }).ok);
assert.ok(!validateAgentResult({ ...good, resolution: " " }).ok);
assert.ok(
  !validateAgentResult({
    ...good,
    screens: [{ name: "Home", components: [{ type: "carousel", label: "x" }] }],
  }).ok
);

// Old answers without an action still pass, as "add".
assert.strictEqual(ok.ok && ok.result.action, "add");
// "ask" needs a question, and draws nothing.
const ask = validateAgentResult({ ...good, action: "ask", question: "New app or change Home?", resolution: "" });
assert.ok(ask.ok && ask.result.screens.length === 0 && ask.result.question);
assert.ok(!validateAgentResult({ ...good, action: "ask", question: " " }).ok);
assert.ok(!validateAgentResult({ ...good, action: "delete" }).ok);
assert.strictEqual(validateAgentResult({ ...good, action: "update" }).result.action, "update");

console.log("agent-schema checks passed");
