// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT — how often a room may run the agent. SERVER ONLY.
//
// Everyone shares the app's free Gemini key, so one busy room could use up
// the whole day's free quota. Two rules, per room:
//   • at most 1 run every 10 seconds (any key)
//   • at most 50 runs a day on the app's built-in key (a person's own key
//     pays for itself, so it isn't counted against the day)
// "Make it real" (app/api/design) counts each design call as one run, with
// no cooldown between them (each screen is its own call, back to back).
//
// The counters live in the room's Liveblocks METADATA. Only our server (with
// the secret key) can write metadata, so people in the room can't reset it,
// unlike room Storage, which every browser can edit.
// The day resets at midnight UTC.
// ─────────────────────────────────────────────────────────────────────────────

import { Liveblocks } from "@liveblocks/node";

export const COOLDOWN_MS = 10_000;
export const DAILY_RUNS = 50;

type Counters = { lastRunAt: number; day: string; runs: number };

/**
 * Pure decision: may this run go ahead? Returns the updated counters, or a
 * friendly message saying when to try again. (Kept separate so it can be
 * tested without Liveblocks: see rate-limit.check.ts.)
 */
export function decide(
  prev: Counters,
  now: number,
  usesBuiltInKey: boolean,
  cooldownMs = COOLDOWN_MS
): { ok: true; next: Counters } | { ok: false; error: string } {
  const wait = prev.lastRunAt + cooldownMs - now;
  if (wait > 0) {
    const s = Math.ceil(wait / 1000);
    return { ok: false, error: `The agent needs a short breather. Try again in ${s} second${s === 1 ? "" : "s"}.` };
  }
  const day = new Date(now).toISOString().slice(0, 10); // "2026-10-12" (UTC)
  const runs = prev.day === day ? prev.runs : 0;
  if (usesBuiltInKey && runs >= DAILY_RUNS) {
    return {
      ok: false,
      error: `This room has used all ${DAILY_RUNS} free agent runs for today. They reset at midnight UTC, or add your own AI key in "Your AI key" to keep going.`,
    };
  }
  return { ok: true, next: { lastRunAt: now, day, runs: usesBuiltInKey ? runs + 1 : runs } };
}

/**
 * Check the room's counters and, if allowed, record this run.
 * Returns null when the run may go ahead, or a friendly error message.
 */
export async function claimAgentRun(roomId: string, usesBuiltInKey: boolean, cooldownMs = COOLDOWN_MS): Promise<string | null> {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret || secret.includes("paste_yours_here")) {
    return "The server isn't set up: LIVEBLOCKS_SECRET_KEY is missing from .env.local.";
  }
  const liveblocks = new Liveblocks({ secret });

  let room;
  try {
    room = await liveblocks.getRoom(roomId);
  } catch {
    return "Couldn't find this room. Reload the page and try again.";
  }
  const m = room.metadata;
  const prev: Counters = {
    lastRunAt: Number(m.agentLastRunAt) || 0,
    day: typeof m.agentDay === "string" ? m.agentDay : "",
    runs: Number(m.agentRuns) || 0,
  };

  const verdict = decide(prev, Date.now(), usesBuiltInKey, cooldownMs);
  if (!verdict.ok) return verdict.error;

  // ponytail: read-then-write, so two clicks in the same instant can both
  // pass. Fine for a 10s cooldown; use an atomic store (e.g. Upstash Redis)
  // if exact counts ever matter.
  try {
    await liveblocks.updateRoom(roomId, {
      metadata: {
        agentLastRunAt: String(verdict.next.lastRunAt),
        agentDay: verdict.next.day,
        agentRuns: String(verdict.next.runs),
      },
    });
  } catch {
    return "The agent couldn't start. Please try again.";
  }
  return null;
}

/**
 * The AI failed (busy, bad key, broken answer): give the run back, so the
 * Retry button works right away and failures don't eat the daily limit.
 * Best effort: if this fails, the next run just waits the normal 10s.
 */
export async function refundAgentRun(roomId: string, usesBuiltInKey: boolean) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return;
  try {
    const liveblocks = new Liveblocks({ secret });
    const runs = Number((await liveblocks.getRoom(roomId)).metadata.agentRuns) || 0;
    await liveblocks.updateRoom(roomId, {
      metadata: { agentLastRunAt: "0", agentRuns: String(usesBuiltInKey ? Math.max(0, runs - 1) : runs) },
    });
  } catch (err) {
    console.error("Rate limit: couldn't refund a failed run:", err);
  }
}
