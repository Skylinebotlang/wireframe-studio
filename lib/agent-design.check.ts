// @ts-nocheck -- dev-only check script, run directly with node
// Self-check for "Make it real": the HTML safety checks, the orange rule,
// and the mock. Run with:
//   node --experimental-strip-types lib/agent-design.check.ts
import assert from "node:assert";
import { checkDesignHtml, checkStyleGuide, isOrange, MOCK_STYLE_GUIDE, mockScreenHtml, MAX_HTML_BYTES } from "./agent-design.ts";

const page = (body, css = "body{color:#222}") => `<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`;

// The mock's sample pages pass the same checks as the AI's.
const screen = { name: "Home", components: [{ type: "header", label: "Hi <there>" }, { type: "button", label: "Go" }, { type: "list", label: "Walks" }] };
const mock = checkDesignHtml(mockScreenHtml(screen, MOCK_STYLE_GUIDE, "darker"));
assert.ok(mock.ok, mock.error);
assert.ok(mock.html.includes("Hi &#60;there&#62;")); // labels are escaped
assert.ok(checkStyleGuide(MOCK_STYLE_GUIDE).ok);

// Scripts, event handlers and embeds are stripped; a clean page remains.
const cleaned = checkDesignHtml(page(`<div onclick="steal()">x</div><script>alert(1)</script><iframe src="x"></iframe><link rel="stylesheet" href="a.css">`));
assert.ok(cleaned.ok);
assert.ok(!/script|onclick|iframe|<link/i.test(cleaned.html));

// Outside addresses are rejected.
assert.ok(!checkDesignHtml(page(`<img src="https://evil.example/x.png">`)).ok);
assert.ok(!checkDesignHtml(page("x", "body{background:url(//evil.example/a.png)}")).ok);
assert.ok(!checkDesignHtml(page("x", "@import 'x.css';")).ok);
assert.ok(!checkDesignHtml(page(`<a href="javascript:alert(1)">x</a>`)).ok);
assert.ok(checkDesignHtml(page(`<img src="data:image/png;base64,AAAA">`)).ok); // data: is fine

// Orange (reserved for the AI) is rejected; the word in text is fine.
assert.ok(!checkDesignHtml(page("x", ".b{background:#ff6b2c}")).ok);
assert.ok(!checkDesignHtml(page("x", ".b{color:rgb(255,140,0)}")).ok);
assert.ok(!checkDesignHtml(page("x", ".b{color:orange}")).ok);
assert.ok(!checkDesignHtml(page(`<svg><rect fill="#f97316"/></svg>`)).ok);
assert.ok(checkDesignHtml(page("Fresh orange juice", ".b{color:#4f46e5}")).ok);
assert.ok(isOrange("#ff6b2c") && !isOrange("#4f46e5") && !isOrange("#ffffff"));
assert.ok(!checkStyleGuide({ ...MOCK_STYLE_GUIDE, colors: { ...MOCK_STYLE_GUIDE.colors, primary: "#ff7a00" } }).ok);

// Not a whole page, or too big → rejected.
assert.ok(!checkDesignHtml("<div>just a fragment</div>").ok);
assert.ok(!checkDesignHtml(page("x".repeat(MAX_HTML_BYTES))).ok);

console.log("agent-design checks passed");
