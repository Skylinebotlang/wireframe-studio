// ─────────────────────────────────────────────────────────────────────────────
// MAKE IT REAL — POST /api/design   (stage 2: wireframes → real mockups)
//
// ONE AI call per request, so no request runs into the time limit and the
// browser can show each design as soon as it's ready (lib/agent-design-room.ts
// drives a whole "Make it real" run, one request at a time):
//
//   { kind: "style", roomId, idea, resolution, screens: ["Home", …], aiKey? }
//     → { styleGuide, providerLabel, usedOwnKey }
//   { kind: "screen", roomId, idea, resolution, styleGuide, screen: { name,
//     components: [{ type, label, notes? }] }, otherScreens, instruction?, aiKey? }
//     → { html, providerLabel, usedOwnKey }
//   Errors always → { error: "a sentence a person can read" }
//
// Every answer is checked before it's returned (lib/agent-design.ts): the
// style guide's colors, and the HTML's size and safety (no scripts, no
// outside links, no orange…). A page that fails is rejected, never cleaned
// up silently into something half-broken.
//
// KEYS: same as the agent (lib/agent-brains.ts pickBrain): the person's own
// key for this one call, else the app's built-in Gemini (or Claude) key.
// Each call counts as one run against the room's daily limit
// (lib/rate-limit.ts), with no cooldown between screens.
// AGENT_PROVIDER=mock (not in production) answers with fixed samples, no AI
// and no rate limit, for testing.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { askBrain, pickBrain, type BrainJob } from "@/lib/agent-brains";
import { claimAgentRun } from "@/lib/rate-limit";
import { PROVIDERS } from "@/lib/ai-providers";
import {
  checkDesignHtml,
  checkStyleGuide,
  MAX_DESIGN_SCREENS,
  MOCK_STYLE_GUIDE,
  mockScreenHtml,
  SCREEN_HTML_JSON_SCHEMA,
  SCREEN_SYSTEM_PROMPT,
  screenUserMessage,
  STYLE_GUIDE_JSON_SCHEMA,
  STYLE_SYSTEM_PROMPT,
  styleUserMessage,
  type DesignScreen,
} from "@/lib/agent-design";

// One screen's design can take a while to write.
export const maxDuration = 120;

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/; // same rule as liveblocks-auth
const MAX_IDEA_CHARS = 1000;
const MAX_RESOLUTION_CHARS = 2000;
const MAX_INSTRUCTION_CHARS = 300;
const MAX_NAME_CHARS = 60;
const MAX_COMPONENTS = 30;
const MOCK_DELAY_MS = 1200; // time to try Pause / Take over while testing

const STYLE_JOB: BrainJob = {
  system: STYLE_SYSTEM_PROMPT,
  schema: STYLE_GUIDE_JSON_SCHEMA,
  toolName: "submit_style_guide",
  toolDescription: "Submit the app's style guide.",
};
const SCREEN_JOB: BrainJob = {
  system: SCREEN_SYSTEM_PROMPT,
  schema: SCREEN_HTML_JSON_SCHEMA,
  toolName: "submit_screen",
  toolDescription: "Submit the finished screen as one self-contained HTML document.",
};

export async function POST(request: Request) {
  // ── 1. Read and check the request ─────────────────────────────────────────
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return friendlyError("The request was not valid JSON.", 400);
  const { kind, roomId } = body;
  if (kind !== "style" && kind !== "screen") return friendlyError("Unknown design request.", 400);
  if (typeof roomId !== "string" || !ROOM_ID_PATTERN.test(roomId)) {
    return friendlyError("Missing or invalid room. Reload the page and try again.", 400);
  }
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
  if (kind === "style") {
    const screens = names(body.screens);
    if (screens.length === 0) return friendlyError("There are no screens to make real yet. Frame an idea first.", 400);
    message = styleUserMessage(idea, resolution, screens);
  } else {
    const checkedGuide = checkStyleGuide(body.styleGuide);
    if (!checkedGuide.ok) return friendlyError(checkedGuide.error, 400);
    guide = checkedGuide.guide;
    screen = readScreen(body.screen);
    if (!screen) return friendlyError("That screen has nothing on it to design.", 400);
    instruction = text(body.instruction, MAX_INSTRUCTION_CHARS);
    message = screenUserMessage({ idea, resolution, guide, screen, otherScreens: names(body.otherScreens), instruction });
  }

  // ── 2. Mock: fixed samples, no AI, no rate limit (never in production) ──
  if (process.env.AGENT_PROVIDER === "mock" && process.env.NODE_ENV !== "production") {
    const info = { providerLabel: "Mock agent", usedOwnKey: false };
    if (kind === "style") return NextResponse.json({ styleGuide: MOCK_STYLE_GUIDE, ...info });
    await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
    const checked = checkDesignHtml(mockScreenHtml(screen!, guide, instruction));
    if (!checked.ok) return friendlyError(checked.error, 502);
    return NextResponse.json({ html: checked.html, ...info });
  }

  // ── 3. Whose key, then the room's daily limit (before the AI is called) ──
  const brain = pickBrain(body.aiKey);
  if ("error" in brain) return friendlyError(brain.error, brain.status);
  const limited = await claimAgentRun(roomId, !brain.usedOwnKey, 0);
  if (limited) return friendlyError(limited, 429);
  const info = { providerLabel: PROVIDERS[brain.provider].label, usedOwnKey: brain.usedOwnKey };

  // ── 4. Ask the AI, then check the answer before it can reach the canvas ──
  const reply = await askBrain(brain.provider, brain.key, message, undefined, kind === "style" ? STYLE_JOB : SCREEN_JOB);
  if ("error" in reply) return friendlyError(reply.error, reply.status);

  if (kind === "style") {
    const checked = checkStyleGuide(reply.data);
    if (!checked.ok) return friendlyError(checked.error, 502);
    return NextResponse.json({ styleGuide: checked.guide, ...info });
  }
  const checked = checkDesignHtml((reply.data as { html?: unknown } | null)?.html);
  if (!checked.ok) {
    console.error(`Design: rejected "${screen!.name}":`, checked.error);
    return friendlyError(checked.error, 502);
  }
  return NextResponse.json({ html: checked.html, ...info });
}

// One wireframe screen from the browser: a name plus its boxes, capped.
function readScreen(value: unknown): DesignScreen | null {
  const s = (value ?? {}) as { name?: unknown; components?: unknown };
  const name = text(s.name, MAX_NAME_CHARS);
  const components = (Array.isArray(s.components) ? s.components : [])
    .slice(0, MAX_COMPONENTS)
    .map((c) => ({ type: text(c?.type, 20) || "text", label: text(c?.label, 120), notes: text(c?.notes, 300) }))
    .filter((c) => c.label);
  return name && components.length ? { name, components } : null;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Every error goes back as { error: "a sentence a person can read" }.
function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
