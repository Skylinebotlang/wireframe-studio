// @ts-nocheck -- dev-only check script, run directly with node
// Self-check for "Make it real": the HTML safety checks, the orange rule,
// and the mock. Run with:
//   node --experimental-strip-types lib/agent-design.check.ts
import assert from "node:assert";
import { visibleText, checkDesignHtml, checkStyleGuide, isOrange, MOCK_STYLE_GUIDE, mockScreenHtml, MAX_HTML_BYTES, contrast, styleCss } from "./agent-design.ts";

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

// ── Strict design system ──
// Bad contrast from the AI is FIXED, not rejected.
const bad = checkStyleGuide({
  product: "X", mood: "y", font: "sans", radius: 12, spacing: 7,
  colors: { background: "#ffffff", surface: "#fafafa", text: "#dddddd", muted: "#f0f0f0", primary: "#ffee00", onPrimary: "#ffffff", accent: "#14b8a6", border: "#eeeeee" },
  type: { display: 20, title: 30, body: 18, caption: 18 },
});
assert.ok(bad.ok);
const g = bad.guide;
assert.ok(contrast(g.colors.text, g.colors.background) >= 4.5, "text readable on background");
assert.ok(contrast(g.colors.text, g.colors.surface) >= 4.5, "text readable on surface");
assert.ok(contrast(g.colors.onPrimary, g.colors.primary) >= 4.5, "button text readable");
assert.ok(contrast(g.colors.muted, g.colors.background) >= 3, "muted text readable");
// Type scale forced in order; spacing snapped to 4 px.
assert.ok(g.type.display > g.type.title && g.type.title > g.type.body && g.type.body > g.type.caption);
assert.strictEqual(g.spacing % 4, 0);
// Tokens the screens rely on are there.
for (const t of ["--space-6", "--radius-lg", "--shadow-2", "--weight-strong"]) assert.ok(styleCss(g).includes(t), t);

// A page that stops mid-way (valid JSON, unfinished HTML) is rejected.
assert.ok(!checkDesignHtml("<!doctype html><html><head><style>body{color:#222}</style></head><body><div class='").ok);
assert.ok(visibleText(page("<p>Hello there</p>")).includes("Hello there"));
console.log("agent-design checks passed");
