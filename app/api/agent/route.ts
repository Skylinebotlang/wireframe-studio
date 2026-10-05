// ─────────────────────────────────────────────────────────────────────────────
// THE AGENT ENDPOINT — POST /api/agent
//
// Two ways in: "Frame your idea" sends one typed idea (the main way), and
// "Send to agent" sends every note on the board.
// This route:
//   1. checks the idea / notes look sane (not empty, not huge),
//   2. picks whose AI key to use (see below),
//   3. sends all the notes to that AI in one message (lib/agent-brains.ts),
//   4. double-checks the JSON answer (lib/agent-schema.ts) before returning it,
//   5. returns a friendly error message if anything goes wrong.
//
// WHOSE KEY RUNS THE AGENT
//   • If the person who clicked sent their own key ("aiKey" in the request,
//     from the "Your AI key" panel), we use it for this ONE call and then
//     forget it. It is never stored or logged.
//   • Otherwise we use the app's built-in key from .env.local:
//       GEMINI_API_KEY    → Google Gemini, free tier (used if set)
//       ANTHROPIC_API_KEY → Claude (set AGENT_PROVIDER=anthropic to force it)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { validateAgentResult, type AgentNote, type BoardScreen } from "@/lib/agent-schema";
import { askBrain } from "@/lib/agent-brains";
import {
  parseUserKey,
  PROVIDERS,
  type AgentRunInfo,
  type ProviderId,
} from "@/lib/ai-providers";

// The AI can take a while to think through a busy board.
export const maxDuration = 120;

// Limits that stop a huge board from producing a huge request.
const MAX_NOTES = 50;
const MAX_NOTE_CHARS = 2000;
const MAX_STEERING = 20; // steering lines from the room's "steer" box
const MAX_STEERING_CHARS = 600;
const MAX_IDEA_CHARS = 1000; // the "Frame your idea" box
const MAX_BOARD_SCREENS = 20; // screens already on the canvas
const MAX_BOARD_LABELS = 30; // boxes per screen
const MAX_HISTORY = 8; // recent ideas + agent questions

export async function POST(request: Request) {
  // ── 1. Read the request ───────────────────────────────────────────────────
  let notes: AgentNote[];
  let idea: string;
  let aiKey: unknown;
  let steering: unknown;
  let board: unknown;
  let history: unknown;
  try {
    const body = await request.json();
    notes = Array.isArray(body?.notes) ? body.notes : [];
    idea = typeof body?.idea === "string" ? body.idea.trim() : "";
    aiKey = body?.aiKey;
    steering = body?.steering;
    board = body?.board;
    history = body?.history;
  } catch {
    return friendlyError("The request was not valid JSON.", 400);
  }

  // ── 2. Check the idea and notes ───────────────────────────────────────────
  if (idea.length > MAX_IDEA_CHARS) {
    return friendlyError(`Your idea is too long (max ${MAX_IDEA_CHARS} characters).`, 400);
  }
  if (!idea && notes.length === 0) {
    return friendlyError("Type an idea in 'Frame your idea', or drop a note on the board first.", 400);
  }
  if (notes.length > MAX_NOTES) {
    return friendlyError(`Too many notes (max ${MAX_NOTES}). Try removing a few.`, 400);
  }
  for (const n of notes) {
    if (
      typeof n?.id !== "string" ||
      typeof n.noteText !== "string" ||
      !n.noteText.trim() ||
      n.noteText.length > MAX_NOTE_CHARS
    ) {
      return friendlyError(`Each note needs some text (max ${MAX_NOTE_CHARS} characters).`, 400);
    }
  }

  // ── 3. Pick whose key to use ──────────────────────────────────────────────
  let provider: ProviderId;
  let key: string;
  let usedOwnKey: boolean;

  if (aiKey !== undefined && aiKey !== null) {
    // The person's own key, from their browser.
    const own = parseUserKey(aiKey);
    if ("error" in own) return friendlyError(own.error, 400);
    ({ provider, key } = own);
    usedOwnKey = true;
  } else {
    // The app's built-in key.
    const geminiKey = usableKey(process.env.GEMINI_API_KEY);
    const claudeKey = usableKey(process.env.ANTHROPIC_API_KEY);
    const useClaude = process.env.AGENT_PROVIDER === "anthropic" || !geminiKey;
    if (useClaude && !claudeKey) {
      return friendlyError(
        "The built-in agent isn't set up: add GEMINI_API_KEY (free, from aistudio.google.com) to .env.local, or add your own key in the 'Your AI key' panel.",
        500
      );
    }
    provider = useClaude ? "anthropic" : "gemini";
    key = (useClaude ? claudeKey : geminiKey)!;
    usedOwnKey = false;
  }

  // Lay the notes out as plain text the AI can read, one block per note.
  const notesBlocks = notes
    .map(
      (n) =>
        `<note id="${attr(n.id)}" author="${attr(n.authorName)}" role="${attr(n.authorRole)}">\n${n.noteText.trim()}\n</note>`
    )
    .join("\n\n");
  // An idea run uses ONLY the typed idea (the board's notes are not sent),
  // plus the screens already drawn and the recent ideas/questions, so the
  // agent can decide to add, update, or ask.
  const notesText = idea
    ? [
        boardText(board),
        textList(history, MAX_HISTORY, "recent_chat", "Earlier ideas and your questions in this room, oldest first:"),
        `A teammate typed this idea:\n<idea>\n${idea}\n</idea>`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : `Here are all the notes on the board:\n\n${notesBlocks}`;

  // Steering: what people typed in the "steer" box (or conflict-card picks)
  // since the last run. The AI must follow these over the notes.
  const steerLines = Array.isArray(steering)
    ? steering
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .slice(-MAX_STEERING)
        .map((s) => `- ${s.trim().slice(0, MAX_STEERING_CHARS)}`)
    : [];
  const promptText = steerLines.length
    ? `${notesText}\n\n<team_steering>\nThe team gave these instructions since the last run. Follow them; they override the notes where they conflict, and mention them in "resolution":\n${steerLines.join("\n")}\n</team_steering>`
    : notesText;

  // ── 4. Ask the AI ─────────────────────────────────────────────────────────
  const reply = await askBrain(provider, key, promptText);
  if ("error" in reply) return friendlyError(reply.error, reply.status);

  // ── 5. Validate the answer before it can reach the canvas ─────────────────
  const checked = validateAgentResult(reply.data);
  if (!checked.ok) {
    console.error("Agent: invalid answer:", checked.error);
    return friendlyError(
      `The agent's answer wasn't in the right format (${checked.error}). Please try again.`,
      502
    );
  }

  // ── 6. Success: the checked result plus who/what ran it (never the key) ───
  const runInfo: AgentRunInfo = {
    provider,
    providerLabel: PROVIDERS[provider].label,
    usedOwnKey,
  };
  return NextResponse.json({ ...checked.result, ...runInfo });
}

// The screens already on the canvas, as plain text for the AI.
function boardText(board: unknown) {
  if (!Array.isArray(board) || board.length === 0) return "<board>\nThe board has no screens yet.\n</board>";
  const lines = (board as BoardScreen[])
    .slice(0, MAX_BOARD_SCREENS)
    .filter((s) => typeof s?.name === "string" && Array.isArray(s.labels))
    .map((s) => {
      const labels = s.labels
        .filter((l): l is string => typeof l === "string")
        .slice(0, MAX_BOARD_LABELS)
        .map((l) => l.slice(0, 100));
      return `- "${s.name.slice(0, 100)}": ${labels.join(" | ")}`;
    });
  return `<board>\nScreens already on the board (top to bottom):\n${lines.join("\n")}\n</board>`;
}

// A short list of text lines inside <tag>, or "" if there are none.
function textList(value: unknown, max: number, tag: string, intro: string) {
  if (!Array.isArray(value)) return "";
  const lines = value
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .slice(-max)
    .map((s) => `- ${s.trim().slice(0, MAX_STEERING_CHARS)}`);
  return lines.length ? `<${tag}>\n${intro}\n${lines.join("\n")}\n</${tag}>` : "";
}

// A key counts as "set" only if it's not empty and not the example placeholder.
function usableKey(key: string | undefined) {
  return key && !key.includes("paste_yours_here") ? key : undefined;
}

// Make a value safe to put inside an attribute="..." (strip quotes and < >).
function attr(value: unknown) {
  return String(value ?? "unknown").replace(/["<>]/g, "").slice(0, 100);
}

// Every error goes back as { error: "a sentence a person can read" }.
function friendlyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
