// ─────────────────────────────────────────────────────────────────────────────
// TEST KEY — POST /api/agent/test-key   body: { aiKey: { provider, key, model? } }
//
// Behind the "Test & save key" button. Makes one free call to the provider
// to see if it accepts the key, then forgets the key. Nothing is stored or
// logged.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { checkKey } from "@/lib/agent/agent-brains";
import { modelFor, parseUserKey, PROVIDERS } from "@/lib/ai-providers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const own = parseUserKey(body?.aiKey);
  if ("error" in own) return NextResponse.json({ ok: false, error: own.error }, { status: 400 });

  const result = await checkKey(own);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const message = `${PROVIDERS[own.provider].label} accepted the key. The agent will use ${modelFor(own)}.`;
  return NextResponse.json({ ok: true, message: result.warning ? `${message} ${result.warning}` : message });
}
