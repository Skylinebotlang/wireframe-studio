// @ts-nocheck -- dev-only check script, run directly with node
// ─────────────────────────────────────────────────────────────────────────────
// SELF-CHECK for lib/ai-providers.ts: key auto-detection and the key /
// model checks. Run: node --experimental-strip-types lib/ai-providers.check.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { detectProvider, modelFor, parseUserKey, PROVIDER_IDS, PROVIDERS } from "./ai-providers.ts";

// Keys with a unique start are recognised (longest match wins: sk-ant- / sk-or- over sk-).
assert.equal(detectProvider("AIzaSyB1234567890"), "gemini");
assert.equal(detectProvider("sk-ant-api03-abc"), "anthropic");
assert.equal(detectProvider("sk-or-v1-abc"), "openrouter");
assert.equal(detectProvider("sk-proj-abc"), "openai");
assert.equal(detectProvider("gsk_abc"), "groq");
assert.equal(detectProvider("  xai-abc "), "xai");
assert.equal(detectProvider("csk-abc"), "cerebras");
assert.equal(detectProvider("fw_abc"), "fireworks");
assert.equal(detectProvider("hf_abc"), "huggingface");
// Plain sk- (OpenAI / DeepSeek / Kimi / Qwen) and pattern-less keys: the person picks.
assert.equal(detectProvider("sk-1234567890abcdef"), null);
assert.equal(detectProvider("a1b2c3d4e5f6"), null);

// Every OpenAI-style provider has an https web address; Gemini and Claude use their own code.
for (const id of PROVIDER_IDS) {
  const p = PROVIDERS[id];
  if (id === "gemini" || id === "anthropic") assert.equal(p.baseUrl, undefined, id);
  else assert.match(p.baseUrl ?? "", /^https:\/\/[^/]+/, id);
}

// Model box: optional, trimmed, odd characters refused.
assert.deepEqual(parseUserKey({ provider: "groq", key: "gsk_1234567890" }), { provider: "groq", key: "gsk_1234567890" });
assert.deepEqual(parseUserKey({ provider: "groq", key: "gsk_1234567890", model: " llama-4 " }), {
  provider: "groq",
  key: "gsk_1234567890",
  model: "llama-4",
});
assert.ok("error" in parseUserKey({ provider: "groq", key: "gsk_1234567890", model: "a b" }));
assert.ok("error" in parseUserKey({ provider: "groq", key: "gsk_1234567890", model: "x\"}" }));
assert.ok("error" in parseUserKey({ provider: "nope", key: "gsk_1234567890" }));
assert.ok("error" in parseUserKey({ provider: "groq", key: "short" }));
assert.equal(modelFor({ provider: "kimi" }), PROVIDERS.kimi.model);
assert.equal(modelFor({ provider: "kimi", model: "kimi-k2.6" }), "kimi-k2.6");

console.log("ai-providers: all checks passed");
