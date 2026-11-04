// ─────────────────────────────────────────────────────────────────────────────
// MAKE IT REAL — POST /api/design   (stage 2: wireframes → real mockups)
//
// ONE AI call per request, so no request runs into the time limit and the
// browser can show each design as soon as it's ready (lib/design/agent-design-room.ts
// drives a whole "Make it real" run, one request at a time):
//
//   { kind: "style", roomId, idea, resolution, screens: ["Home", …], variant?, aiKey? }
//     → { styleGuide, providerLabel, usedOwnKey }
//     (a LOCKED style comes straight back, no AI; variant 1-3 = "Try 3
//      styles", which always asks the AI for a fresh option)
//   { kind: "screen", roomId, idea, resolution, styleGuide, screen: { name,
//     components: [{ type, label, notes? }] }, otherScreens, instruction?, aiKey? }
//     → { html, providerLabel, usedOwnKey }
//   { kind: "review", roomId, idea, styleGuide, screen, html, screenshot?, aiKey? }
//     (screenshot: "data:image/png;base64,…" of the page, made in the browser
//      by lib/design/screenshot.ts; the AI looks at it alongside the HTML)
//     → { html, providerLabel, usedOwnKey }   the same screen, checked against
//       a design checklist and fixed by the AI (the "design director" pass)
//   Errors always → { error: "a sentence a person can read" }
//
// BRIEF: the board's design brief (lib/design/brief.ts) is read from the
// database here and added to every call's message. Its pictures (logo +
// references) go with the style and screen calls; brand basics (main colour,
// font) are forced into the style guide in code.
//
// Every answer is checked before it's returned (lib/design/agent-design.ts): the
// style guide's colors, and the HTML's size and safety (no scripts, no
// outside links, no orange…). A page that fails is rejected, never cleaned
// up silently into something half-broken.
//
// KEYS: same as the agent (lib/agent/agent-brains.ts pickBrain): the person's own
// key for this one call. No own key → refused (there is no app key).
// Each call counts as one run against the room's daily limit
// (lib/server/rate-limit.ts), with no cooldown between screens.
// AGENT_PROVIDER=mock (not in production) answers with fixed samples, no AI
// and no rate limit, for testing.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { askBrain, pickBrain, type BrainJob } from "@/lib/agent/agent-brains";
import { claimAgentRun, refundAgentRun } from "@/lib/server/rate-limit";
import { claimUserRun, refundUserRun } from "@/lib/server/user-limit";
import { getSignedInUser } from "@/lib/server/auth-server";
import { aiCheck } from "@/lib/server/boards-db";
import { getBrief, listImages } from "@/lib/server/brief-db";
import { briefPrompt } from "@/lib/design/brief";
import { patternsPrompt } from "@/lib/design/ui-patterns";
import { PROVIDERS } from "@/lib/ai-providers";
import {
  applyBrand,
  checkDesignHtml,
  checkStyleGuide,
  MAX_DESIGN_SCREENS,
  MOCK_STYLE_GUIDE,
  mockScreenHtml,
  REVIEW_SYSTEM_PROMPT,
  reviewUserMessage,
  visibleText,
  SCREEN_HTML_JSON_SCHEMA,
  SCREEN_SYSTEM_PROMPT,
  screenUserMessage,
  STYLE_GUIDE_JSON_SCHEMA,
  STYLE_SYSTEM_PROMPT,
  styleUserMessage,
  type DesignScreen,
} from "@/lib/design/agent-design";

// One screen's design can take a while to write.
export const maxDuration = 120;

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/; // same rule as liveblocks-auth
const MAX_IDEA_CHARS = 1000;
const MAX_RESOLUTION_CHARS = 2000;
const MAX_INSTRUCTION_CHARS = 300;
const MAX_NAME_CHARS = 60;
const MAX_COMPONENTS = 30;
const MAX_SCREENSHOT_BYTES = 1_500_000; // base64 text of the PNG
const MOCK_DELAY_MS = 1200; // time to try Pause / Take over while testing

// "Try 3 styles": each option is pushed in a different direction, so the
// three are worth comparing (they're asked separately, so they can't see
// each other).
const VARIANTS = [
  "This is option 1 of 3: the closest, safest match to the brief and the idea.",
  "This is option 2 of 3: bolder. Stronger colour, more contrast, more personality.",
  "This is option 3 of 3: quieter. Softer colours, more white space, minimal.",
];

const STYLE_JOB: BrainJob = {
  system: STYLE_SYSTEM_PROMPT,
  schema: STYLE_GUIDE_JSON_SCHEMA,
  toolName: "submit_style_guide",
  toolDescription: "Submit the app's style guide.",
};
const REVIEW_JOB: BrainJob = {
  system: REVIEW_SYSTEM_PROMPT,
  schema: SCREEN_HTML_JSON_SCHEMA,
  toolName: "submit_screen",
  toolDescription: "Submit the reviewed and fixed screen as one self-contained HTML document.",
};
const SCREEN_JOB: BrainJob = {
  system: SCREEN_SYSTEM_PROMPT,
  schema: SCREEN_HTML_JSON_SCHEMA,
  toolName: "submit_screen",
  toolDescription: "Submit the finished screen as one self-contained HTML document.",
};

export async function POST(request: Request) {
  // ── 0. Signed-in people only (like every other API) ───────────────────────
  const me = await getSignedInUser(request);
  if (!me) return friendlyError("Please sign in to use Make it real.", 401);

  // ── 1. Read and check the request ─────────────────────────────────────────
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return friendlyError("The request was not valid JSON.", 400);
  const { kind, roomId } = body;
  if (kind !== "style" && kind !== "screen" && kind !== "review") return friendlyError("Unknown design request.", 400);
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) {
    return friendlyError("Missing or invalid room. Reload the page and try again.", 400);
  }
  // Only editors and the owner make designs (roles: lib/roles.ts). The
  // board's design brief is read at the same time (we load it here, never
  // take it from the browser). No brief, or it can't be read → design without.
  // Reviews only need the rules (no pictures: they already have a screenshot).
  const [notAllowed, brief, pictures] = await Promise.all([
    aiCheck(me.id, roomId),
    getBrief(roomId).catch((err) => {
      console.error("Design: couldn't read the brief:", err);
      return null;
    }),
    kind === "review"
      ? []
      : listImages(roomId).catch((err) => {
          console.error("Design: couldn't read the brief's pictures:", err);
          return [];
        }),
  ]);
  if (notAllowed) return friendlyError(notAllowed, 403);
  const idea = text(body.idea, MAX_IDEA_CHARS);
  const resolution = text(body.resolution, MAX_RESOLUTION_CHARS);
  const names = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .filter((n): n is string => typeof n === "string" && n.trim() !== "")
      .slice(0, MAX_DESIGN_SCREENS)
      .map((n) => n.trim().slice(0, MAX_NAME_CHARS));

  let message: string;
  let screen: DesignScreen | null = null;
  let instruction = "";
  let guide = MOCK_STYLE_GUIDE;
  let draft = ""; // review: the page to check
  let images: NonNullable<BrainJob["images"]> = []; // pictures sent with the call
  // "Try 3 styles": which of the 3 options this is (1-3), or 0 for a normal run.
  const variant = [1, 2, 3].includes(body.variant as number) ? (body.variant as number) : 0;
  if (kind === "style") {
    const screens = names(body.screens);
    if (screens.length === 0) return friendlyError("There are no screens to make real yet. Frame an idea first.", 400);
    // A locked style is reused as it is: no AI call, nothing counted.
    // ("Try 3 styles" ignores the lock: it's asking for new options.)
    if (brief?.lockedStyle && !variant) {
      return NextResponse.json({ styleGuide: brief.lockedStyle, providerLabel: "the locked style", usedOwnKey: true });
    }
    message = styleUserMessage(idea, resolution, screens) + (variant ? "\n\n" + VARIANTS[variant - 1] : "");
  } else {
    const checkedGuide = checkStyleGuide(body.styleGuide);
    if (!checkedGuide.ok) return friendlyError(checkedGuide.error, 400);
    guide = checkedGuide.guide;
    screen = readScreen(body.screen);
    if (!screen) return friendlyError("That screen has nothing on it to design.", 400);
    if (kind === "review") {
      const page = checkDesignHtml(body.html); // only a page that passed before
      if (!page.ok) return friendlyError("That design can't be reviewed.", 400);
      draft = page.html;
      const m = typeof body.screenshot === "string" ? body.screenshot.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
      if (m && m[1].length <= MAX_SCREENSHOT_BYTES) images = [{ mime: "image/png", base64: m[1] }];
      message = reviewUserMessage({ idea, guide, screen, html: draft });
    } else {
      instruction = text(body.instruction, MAX_INSTRUCTION_CHARS);
      const inspiration = patternsPrompt(screen.name, screen.components.map((c) => c.label), idea);
      message = screenUserMessage({ idea, resolution, guide, screen, otherScreens: names(body.otherScreens), instruction, inspiration });
    }
  }

  // The team's design brief (lib/design/brief.ts) goes with every kind of
  // call; its pictures (logo + references) with the style and screen calls.
  if (pictures.length) images = pictures.map((p) => ({ mime: p.mime, base64: p.base64 }));
  const briefBlock = brief ? briefPrompt(brief, pictures) : "";
  if (briefBlock) message += "\n\n" + briefBlock;

  // ── 2. Mock: fixed samples, no AI, no rate limit (never in production) ──
  if (process.env.AGENT_PROVIDER === "mock" && process.env.NODE_ENV !== "production") {
    const info = { providerLabel: "Mock agent", usedOwnKey: false };
    if (kind === "style") return NextResponse.json({ styleGuide: brief ? applyBrand(MOCK_STYLE_GUIDE, brief) : MOCK_STYLE_GUIDE, ...info });
    await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
    if (kind === "review") return NextResponse.json({ html: draft, ...info }); // mock: unchanged
    const checked = checkDesignHtml(mockScreenHtml(screen!, guide, instruction));
    if (!checked.ok) return friendlyError(checked.error, 502);
    return NextResponse.json({ html: checked.html, ...info });
  }

  // ── 3. Whose key, then the room's daily limit (before the AI is called) ──
  const brain = pickBrain(body.aiKey);
  if ("error" in brain) return friendlyError(brain.error, brain.status);
  const personal = brain.usedOwnKey ? null : await claimUserRun(me.id);
  if (personal) return friendlyError(personal, 429);
  const limited = await claimAgentRun(roomId, !brain.usedOwnKey, 0);
  if (limited) {
    if (!brain.usedOwnKey) await refundUserRun(me.id);
    return friendlyError(limited, 429);
  }
  const info = { providerLabel: PROVIDERS[brain.provider].label, usedOwnKey: brain.usedOwnKey };

  // ── 4. Ask the AI, then check the answer before it can reach the canvas ──
  const job = { ...(kind === "style" ? STYLE_JOB : kind === "review" ? REVIEW_JOB : SCREEN_JOB), images };
  // A failed AI call gives its run back (same as the agent; see Retry).
  const failed = async (message: string, status: number) => {
    await refundAgentRun(roomId, !brain.usedOwnKey);
    if (!brain.usedOwnKey) await refundUserRun(me.id);
    return friendlyError(message, status);
  };
  const reply = await askBrain(brain, message, undefined, job);
  if ("error" in reply) return failed(reply.error, reply.status);

  if (kind === "style") {
    const checked = checkStyleGuide(reply.data);
    if (!checked.ok) return failed(checked.error, 502);
    // Brand basics win over the AI's picks (main colour, font).
    return NextResponse.json({ styleGuide: brief ? applyBrand(checked.guide, brief) : checked.guide, ...info });
  }
  let checked = checkDesignHtml((reply.data as { html?: unknown } | null)?.html);
  // A review may tidy the page, never gut it: keep most of what people see.
  if (checked.ok && kind === "review" && visibleText(checked.html).length < visibleText(draft).length * 0.7) {
    checked = { ok: false, error: "The review dropped part of the screen, so the first version stays." };
  }
  if (!checked.ok) {
    console.error(`Design: rejected "${screen!.name}" (${kind}):`, checked.error);
    return failed(checked.error, 502);
  }
  return NextResponse.json({ html: checked.html, ...info });
}

// One wireframe screen from the browser: a name plus its boxes, capped.
function readScreen(value: unknown): DesignScreen | null {
  const s = (value ?? {}) as { name?: unknown; components?: unknown };
  const name = text(s.name, MAX_NAME_CHARS);
  const components = (Array.isArray(s.components) ? s.components : [])
    .slice(0, MAX_COMPONENTS)
    .map((c) => ({
      type: text(c?.type, 20) || "text",
      label: text(c?.label, 120),
      notes: text(c?.notes, 300),
      ...([2, 3].includes(c?.columns) ? { columns: c.columns as number } : {}),
    }))
    .filter((c) => c.label);
  return name && components.length ? { name, components } : null;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Every error goes back as { error: "a sentence a person can read" }.
function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
