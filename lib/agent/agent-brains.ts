// ─────────────────────────────────────────────────────────────────────────────
// AGENT BRAINS — how we talk to each AI provider. SERVER ONLY.
//
// Three connections: Gemini, Claude, and one "OpenAI-style" connection that
// serves OpenAI and every other provider in lib/ai-providers.ts (Groq,
// OpenRouter, DeepSeek…), each at its own web address.
// Each "ask" function sends one message to one provider and returns either
// the raw JSON answer or a friendly error that names the problem. A "job"
// says which instructions and answer format to use: stage 1 draws wireframes
// (the default), stage 2 designs real screens (lib/design/agent-design.ts).
// `checkKey` does a free, harmless call to see if a key is accepted.
//
// KEY SAFETY: a key passed in here is used for one request and then
// forgotten. We never store it, and every log line goes through `safeLog`,
// which blanks the key out in case a provider echoes it back.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { AGENT_RESULT_JSON_SCHEMA } from "./agent-schema";
import { modelFor, NEED_OWN_KEY, parseUserKey, PROVIDERS, type ProviderId, type UserKey } from "@/lib/ai-providers";

// The instructions the AI gets on every run (same for every provider).
const SYSTEM_PROMPT = `You are the AI teammate on a shared product-design canvas. PMs, designers and developers each leave prompt notes describing what they want. You read ALL the notes together and turn them into simple mobile wireframes.

How to work:
- Find notes that disagree (for example "PM wants a summary on top" vs "designer wants it minimal"). List each disagreement in "conflicts", with the ids of the clashing notes and one plain sentence on why they clash. If nobody disagrees, return an empty list.
- Decide how to merge everyone's wishes. Explain it in "resolution": one short paragraph, written for the whole team, naming whose idea you kept where and why.
- Design the screens. Each screen is a phone-sized wireframe: a name plus components listed top to bottom. Use only these component types: header, text, input, button, card, list, image (an image placeholder), summary (a summary block), tabbar (a bottom navigation bar). Give each a short label, and put extra detail in "notes" (use "" when there's nothing to add).
- Lay screens out like real apps, not just a single stack:
  - "columns" (1, 2 or 3): neighbouring components with the same columns sit side by side. Two buttons with columns 2 make a row ("Cancel" / "Save"); four cards with columns 2 make a 2×2 grid; three stat cards with columns 3 make one row. Use 1 for anything full width (headers, inputs, lists, long text). Only use 2 or 3 when there really are that many items side by side: for a grid, list EACH item as its own component (e.g. four "card" components "Pizza", "Sushi", "Burgers", "Salads", each with columns 2), never one component standing for the whole grid.
  - tabbar: for screens of an app with main sections, add ONE tabbar whose label lists the tabs separated by "|", e.g. "Home | Search | Profile" (2 to 5 tabs). It is always drawn at the bottom. Leave it out of sign-up, login and one-off flow screens.
- Keep it focused: usually 1 to 4 screens, about 3 to 10 components each.
- Sometimes there are no notes, only one idea a teammate typed (inside <idea>). Then design from that idea, return an empty "conflicts" list, and use "resolution" to say briefly how you read the idea.
- Choose "action":
  - "add": draw brand-new screens. Use this for notes, for a new idea, or when nothing is on the board.
  - "update": the idea changes screens already on the board (listed in <board>). Return each changed screen with EXACTLY the same name so it replaces the old one, keeping what people put there unless the idea changes it. Return only the screens that change, plus any new ones.
  - "ask": you really can't tell whether the idea is new screens or a change to existing ones. Put one short, friendly question in "question" (for example "Should I change the Home screen, or start a new flow?") and return no screens. Use <recent_chat> to understand answers to your earlier questions; don't ask the same thing twice.
  Use "question": "" unless the action is "ask".`;

// The route already wrote the full message (an idea, or the board's notes).
const userMessage = (notesText: string) => notesText;

// What to ask for: the instructions, the JSON answer format, and (for
// Claude) the name of the tool it answers with.
export type BrainJob = {
  system: string;
  schema: object;
  toolName: string;
  toolDescription: string;
  // Optional pictures sent with the message: the review's screenshot, the
  // brief's logo and reference images (app/api/design).
  images?: { mime: "image/png" | "image/jpeg"; base64: string }[];
};

const WIREFRAME_JOB: BrainJob = {
  system: SYSTEM_PROMPT,
  schema: AGENT_RESULT_JSON_SCHEMA,
  toolName: "submit_wireframes",
  toolDescription: "Submit the conflicts found between the notes, the merge explanation, and the wireframe screens.",
};

// Gemini models to try, in order. If one is busy ("high demand") or out of
// free quota, we try the next. The first is the one listed in ai-providers.
const GEMINI_MODELS = [
  PROVIDERS.gemini.model,
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

export type BrainReply = { data: unknown } | { error: string; status: number };

// Called with the answer text so far, every time more of it arrives.
// Only Gemini streams today; the others answer in one go.
export type OnText = (textSoFar: string) => void;

/** Send the message to the chosen provider using the person's key (and model, if they typed one). */
export function askBrain(brain: UserKey, notesText: string, onText?: OnText, job = WIREFRAME_JOB) {
  const { provider, key, model } = brain;
  if (provider === "anthropic") return askClaude(key, modelFor(brain), notesText, job);
  if (provider === "gemini") return askGemini(key, model, notesText, onText, job);
  return askOpenAI(provider, key, modelFor(brain), notesText, job);
}

/**
 * Whose key runs the agent: ALWAYS the person's own key, sent by their
 * browser for this one call (never stored). There is no app key to fall back
 * on: without their own key the agent refuses, with a friendly reason.
 */
export function pickBrain(aiKey: unknown):
  | (UserKey & { usedOwnKey: boolean })
  | { error: string; status: number } {
  if (aiKey !== undefined && aiKey !== null) {
    const own = parseUserKey(aiKey);
    if ("error" in own) return { error: own.error, status: 400 };
    return { ...own, usedOwnKey: true };
  }
  return { error: NEED_OWN_KEY, status: 400 };
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GEMINI — asks for JSON that follows our schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
// A model the person typed is the only one tried; otherwise our list.
async function askGemini(key: string, chosen: string | undefined, notesText: string, onText: OnText | undefined, job: BrainJob): Promise<BrainReply> {
  let reply: BrainReply = { error: "No Gemini model available.", status: 502 };
  let busy: BrainReply | undefined;
  for (const model of chosen ? [chosen] : GEMINI_MODELS) {
    reply = await askGeminiModel(model, key, notesText, onText, job);
    if (!("error" in reply)) return reply;
    // Only move on when this model is busy, out of quota, or not offered to
    // this key (404). Remember "busy" so the person sees that message.
    if (reply.status === 503 || reply.status === 429) busy = reply;
    else if (reply.status !== 404) return reply;
  }
  return busy ?? reply;
}

// With `onText`, Gemini streams its answer (server-sent events) and we pass
// the text along as it grows; without it, one normal request.
async function askGeminiModel(model: string, key: string, notesText: string, onText: OnText | undefined, job: BrainJob): Promise<BrainReply> {
  const endpoint = onText ? `${model}:streamGenerateContent?alt=sse` : `${model}:generateContent`;
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${endpoint}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: job.system }] },
          contents: [
            {
              role: "user",
              parts: [
                ...(job.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } })),
                { text: userMessage(notesText) },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: job.schema,
          },
        }),
      }
    );
  } catch (err) {
    safeLog(`Gemini (${model}) request failed`, err, key);
    return { error: "Couldn't reach Google Gemini. Check your internet connection.", status: 502 };
  }

  if (onText && res.ok && res.body) return readGeminiStream(res.body, key, onText);

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    safeLog(`Gemini (${model}) error ${res.status}`, body, key);
    const failure = geminiFailure(res.status, body);
    if (failure) return failure;
    if (res.status === 404) return { error: "Gemini model not found.", status: 404 };
    return { error: "The agent ran into a problem talking to Gemini. Please try again.", status: 502 };
  }

  // Gemini puts its answer (a JSON string) in the first candidate's text.
  // Long answers can arrive split over several parts, so join them all
  // (skipping "thought" parts, which are the model's notes, not the answer).
  const candidate = body?.candidates?.[0];
  const text = geminiText(candidate?.content?.parts);
  if (!text) {
    safeLog("Gemini returned no text", body, key);
    return { error: "Gemini didn't return any wireframes. Try rewording the notes.", status: 502 };
  }
  return parseGemini(text, candidate?.finishReason, key);
}

// Read Gemini's event stream: each "data: {…}" line carries the next bit of
// answer text. Returns the whole answer, parsed, once the stream ends.
async function readGeminiStream(stream: ReadableStream<Uint8Array>, key: string, onText: OnText): Promise<BrainReply> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finishReason: unknown;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep a half-received line for next time
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5));
        text += geminiText(event?.candidates?.[0]?.content?.parts);
        finishReason = event?.candidates?.[0]?.finishReason ?? finishReason;
        onText(text);
      }
    }
  } catch (err) {
    safeLog("Gemini stream broke off", err, key);
    return { error: "The connection to Gemini dropped mid-answer. Please try again.", status: 502 };
  }
  if (!text) return { error: "Gemini didn't return any wireframes. Try rewording the notes.", status: 502 };
  return parseGemini(text, finishReason, key);
}

// The answer text from a list of Gemini parts ("" if there's none).
function geminiText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => typeof p?.text === "string" && !p.thought)
    .map((p) => p.text as string)
    .join("");
}

// Parse Gemini's JSON; if it fails, say WHY when Gemini told us.
function parseGemini(text: string, finishReason: unknown, key: string): BrainReply {
  const parsed = parseJson(text, "Gemini");
  if (!("error" in parsed)) return parsed;
  safeLog(`Gemini answer didn't parse (finishReason ${String(finishReason)}, ${text.length} chars)`, text.slice(-300), key);
  if (finishReason === "MAX_TOKENS") {
    return { error: "Gemini's answer was too long and got cut off. Try asking for fewer screens.", status: 502 };
  }
  if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "PROHIBITED_CONTENT") {
    return { error: "Gemini stopped this answer early (its safety filter). Try rewording the idea.", status: 502 };
  }
  return parsed;
}

// Turn a Gemini error into a friendly message (shared with checkKey).
function geminiFailure(status: number, body: unknown): { error: string; status: number } | null {
  const raw = JSON.stringify(body ?? "");
  if (raw.includes("API_KEY_INVALID") || status === 401 || status === 403) {
    return { error: "Gemini rejected this API key. Check you copied the whole key from Google AI Studio.", status: 401 };
  }
  if (status === 429) {
    return { error: "This Gemini key has hit its usage limit for now. Wait a minute (or until tomorrow) and try again.", status: 429 };
  }
  if (status === 503) {
    return { error: "Gemini is very busy right now. Wait a minute and try again.", status: 503 };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC CLAUDE — answers by calling a "submit_wireframes" tool whose
// input must match our schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
async function askClaude(key: string, model: string, notesText: string, job: BrainJob): Promise<BrainReply> {
  const client = new Anthropic({ apiKey: key });
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    // Streaming keeps long answers from timing out; finalMessage() waits
    // for the complete answer.
    response = await client.beta.messages
      .stream({
        model,
        max_tokens: 16000,
        system: job.system,
        // If Claude declines for a safety reason, the API retries on a
        // fallback model automatically instead of just failing.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: [
          {
            name: job.toolName,
            description: job.toolDescription,
            strict: true, // Claude's answer must match the schema exactly
            input_schema: job.schema as unknown as Anthropic.Beta.Messages.BetaTool.InputSchema,
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              ...(job.images ?? []).map((i) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: i.mime, data: i.base64 },
              })),
              { type: "text" as const, text: `${userMessage(notesText)}\n\nAnswer by calling ${job.toolName} exactly once.` },
            ],
          },
        ],
      })
      .finalMessage();
  } catch (err) {
    safeLog("Claude request failed", err, key);
    return claudeFailure(err);
  }

  if (response.stop_reason === "refusal") {
    return { error: "Claude declined these notes. Try rewording them.", status: 422 };
  }
  if (response.stop_reason === "max_tokens") {
    return { error: "Claude's answer was too long and got cut off. Try fewer notes.", status: 422 };
  }
  const toolCall = response.content.find(
    (block) => block.type === "tool_use" && block.name === job.toolName
  );
  if (!toolCall || toolCall.type !== "tool_use") {
    return { error: "Claude didn't return any wireframes. Please try again.", status: 502 };
  }
  return { data: toolCall.input };
}

// Turn a Claude SDK error into a friendly message (shared with checkKey).
function claudeFailure(err: unknown): { error: string; status: number } {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { error: "Anthropic rejected this API key. Check you copied the whole key from the Anthropic Console.", status: 401 };
  }
  if (err instanceof Anthropic.BadRequestError && err.message.includes("credit balance")) {
    return { error: "This Anthropic account is out of credit. Add credits at console.anthropic.com → Plans & Billing.", status: 402 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { error: "This Claude key is getting too many requests right now. Wait a moment and try again.", status: 429 };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { error: "Couldn't reach Anthropic. Check your internet connection.", status: 502 };
  }
  return { error: "The agent ran into a problem talking to Claude. Please try again.", status: 502 };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENAI-STYLE PROVIDERS — OpenAI, Groq, OpenRouter, DeepSeek, Mistral… all
// take the same request at their own web address (`baseUrl`).
//
// Best case, "structured outputs" make the reply follow our schema exactly.
// Not every provider or model supports that (or pictures), so on a "bad
// request" (400) we ask again, simpler each time:
//   1. strict schema (+ pictures)
//   2. plain JSON mode, schema written into the instructions (+ pictures)
//   3. plain JSON mode without the pictures (text-only models)
// The route checks every answer before drawing, so plain JSON is safe.
// ─────────────────────────────────────────────────────────────────────────────
async function askOpenAI(provider: ProviderId, key: string, model: string, notesText: string, job: BrainJob): Promise<BrainReply> {
  const { label, baseUrl } = PROVIDERS[provider];
  const pictures = job.images ?? [];
  const tries = [
    { strict: true, images: pictures },
    { strict: false, images: pictures },
    ...(pictures.length ? [{ strict: false, images: [] }] : []),
  ];

  for (let i = 0; i < tries.length; i++) {
    const { strict, images } = tries[i];
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: strict
                ? job.system
                : `${job.system}\n\nReply with only a JSON object that follows this JSON schema exactly:\n${JSON.stringify(job.schema)}`,
            },
            {
              role: "user",
              content: images.length
                ? [
                    ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } })),
                    { type: "text", text: userMessage(notesText) },
                  ]
                : userMessage(notesText),
            },
          ],
          response_format: strict
            ? { type: "json_schema", json_schema: { name: job.toolName, strict: true, schema: job.schema } }
            : { type: "json_object" },
        }),
      });
    } catch (err) {
      safeLog(`${label} request failed`, err, key);
      return { error: `Couldn't reach ${label}. Check your internet connection.`, status: 502 };
    }

    const body = await res.json().catch(() => null);
    if (res.status === 400 && i < tries.length - 1) {
      safeLog(`${label} (${model}) said 400, trying a simpler request`, body, key);
      continue;
    }
    if (!res.ok) {
      safeLog(`${label} (${model}) error ${res.status}`, body, key);
      return openAIFailure(provider, model, res.status, body);
    }

    const message = body?.choices?.[0]?.message;
    if (message?.refusal) {
      return { error: `${label} declined these notes. Try rewording them.`, status: 422 };
    }
    if (typeof message?.content !== "string" || !message.content.trim()) {
      return { error: `${label} didn't return any wireframes. Please try again.`, status: 502 };
    }
    // Some models wrap plain-JSON answers in ```json … ``` fences.
    return parseJson(message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""), label);
  }
  return { error: `The agent ran into a problem talking to ${label}. Please try again.`, status: 502 };
}

// Turn an OpenAI-style error into a friendly message (shared with checkKey).
function openAIFailure(provider: ProviderId, model: string, status: number, body: unknown): { error: string; status: number } {
  const { label, keySite } = PROVIDERS[provider];
  const code = (body as { error?: { code?: string } } | null)?.error?.code;
  // Most say 401/403 for a bad key; some (xAI) say 400 "Incorrect API key".
  const badKey = status === 400 && /api[ _-]?key/i.test(JSON.stringify(body ?? ""));
  if (status === 401 || status === 403 || badKey) {
    return { error: `${label} rejected this API key. Check you copied the whole key from ${keySite}.`, status: 401 };
  }
  if (status === 402 || code === "insufficient_quota") {
    return { error: `This ${label} account is out of credit. Add credits on ${keySite}.`, status: 402 };
  }
  if (status === 404) {
    return { error: `${label} doesn't offer the model "${model}" to this key. Type another model name in "Your AI key".`, status: 404 };
  }
  if (status === 429) {
    return { error: `This ${label} key is getting too many requests right now. Wait a moment and try again.`, status: 429 };
  }
  return { error: `The agent ran into a problem talking to ${label}. Please try again.`, status: 502 };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST KEY — a free call (list the available models, or "who am I") that
// only succeeds if the provider accepts the key. It can't spot an empty
// credit balance; that shows up as a clear error on the first real run.
// When the provider lists its models and the chosen one isn't there, we
// still save the key but warn (lists don't always name every model).
// ─────────────────────────────────────────────────────────────────────────────
export async function checkKey(brain: UserKey): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  const { provider, key } = brain;
  const { label, company, baseUrl, checkUrl } = PROVIDERS[provider];
  const model = modelFor(brain);
  try {
    if (provider === "anthropic") {
      await new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 });
      return { ok: true };
    }

    const res =
      provider === "gemini"
        ? await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
            headers: { "x-goog-api-key": key },
          })
        : checkUrl === "chat"
          ? // Its model list is public, so ask for a 1-word answer instead (costs a tiny fraction of a cent).
            await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
              body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "Hi" }] }),
            })
          : await fetch(checkUrl ?? `${baseUrl}/models`, { headers: { authorization: `Bearer ${key}` } });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      const ids = !checkUrl && Array.isArray(body?.data) ? body.data.map((m: { id?: unknown }) => m?.id) : null;
      if (provider !== "gemini" && ids && ids.length && !ids.includes(model)) {
        return { ok: true, warning: `${label} didn't list the model "${model}" for this key. If runs fail, type another model name.` };
      }
      return { ok: true };
    }

    safeLog(`${provider} key check failed ${res.status}`, body, key);
    const failure = provider === "gemini" ? geminiFailure(res.status, body) : openAIFailure(provider, model, res.status, body);
    return { ok: false, error: failure?.error ?? `${label} didn't accept the key. Please try again.` };
  } catch (err) {
    if (provider === "anthropic") {
      safeLog("anthropic key check failed", err, key);
      return { ok: false, error: claudeFailure(err).error };
    }
    return { ok: false, error: `Couldn't reach ${company}. Check your internet connection.` };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseJson(text: string, label: string): BrainReply {
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: `${label}'s answer got cut off or garbled. Please try again.`, status: 502 };
  }
}

/** Log an error for debugging, with the API key blanked out. */
function safeLog(label: string, detail: unknown, key: string) {
  let text: string;
  try {
    text = detail instanceof Error ? `${detail.name}: ${detail.message}` : JSON.stringify(detail);
  } catch {
    text = String(detail);
  }
  console.error(`Agent: ${label}:`, key ? text.split(key).join("[hidden key]") : text);
}
