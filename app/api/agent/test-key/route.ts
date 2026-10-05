// ─────────────────────────────────────────────────────────────────────────────
// TEST KEY — POST /api/agent/test-key   body: { aiKey: { provider, key } }
//
// Behind the "Test key" button. Makes one free call to the provider to see
// if it accepts the key, then forgets the key. Nothing is stored or logged.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { checkKey } from "@/lib/agent-brains";
import { parseUserKey, PROVIDERS } from "@/lib/ai-providers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const own = parseUserKey(body?.aiKey);
  if ("error" in own) return NextResponse.json({ ok: false, error: own.error }, { status: 400 });

  const result = await checkKey(own.provider, own.key);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const { label, model } = PROVIDERS[own.provider];
  return NextResponse.json({ ok: true, message: `${label} accepted the key. The agent will use ${model}.` });
}
