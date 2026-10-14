// ─────────────────────────────────────────────────────────────────────────────
// PER-PERSON DAILY LIMIT — how many agent runs one account may use per day on
// the app's own AI key. SERVER ONLY.
//
// Works alongside the per-room limit (lib/rate-limit.ts): a run needs room in
// BOTH. Without this, one person could dodge the room's 50 a day by opening
// new rooms. A person's own key ("Your AI key") pays for itself and isn't
// counted.
//
// The count lives in Supabase (table agent_usage, one row per person per
// day, UTC). The database function claim_agent_run adds 1 and checks the
// limit in ONE step, so two clicks at the same instant can't both slip past.
// SQL: supabase/agent-usage.sql
// ─────────────────────────────────────────────────────────────────────────────

import { boardsConfigured, rest } from "./boards-db";
import { DAILY_RUNS } from "./rate-limit";

/** Count one run for this person. Returns null if allowed, else a friendly message. */
export async function claimUserRun(userId: string): Promise<string | null> {
  if (!boardsConfigured()) return null; // no database set up: the room limit still applies
  try {
    const ok = await rest("rpc/claim_agent_run", {
      method: "POST",
      body: JSON.stringify({ p_user: userId, p_limit: DAILY_RUNS }),
    });
    return ok === true
      ? null
      : `You've used all ${DAILY_RUNS} of your agent runs for today. They reset at midnight UTC, or add your own AI key in "Your AI key" to keep going.`;
  } catch (err) {
    // Don't block people because the counter is unreachable; the room
    // limit still protects the key.
    console.error("Per-person limit: couldn't check:", err);
    return null;
  }
}

/** Give a run back (the AI failed, or the room said no after all). */
export async function refundUserRun(userId: string) {
  if (!boardsConfigured()) return;
  try {
    await rest("rpc/refund_agent_run", { method: "POST", body: JSON.stringify({ p_user: userId }) });
  } catch (err) {
    console.error("Per-person limit: couldn't refund:", err);
  }
}
