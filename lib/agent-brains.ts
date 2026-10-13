// ─────────────────────────────────────────────────────────────────────────────
// AGENT BRAINS — how we talk to each AI provider. SERVER ONLY.
//
// Each "ask" function sends one message to one provider and returns either
// the raw JSON answer or a friendly error that names the problem. A "job"
// says which instructions and answer format to use: stage 1 draws wireframes
// (the default), stage 2 designs real screens (lib/agent-design.ts).
// `checkKey` does a free, harmless call to see if a key is accepted.
//
// KEY SAFETY: a key passed in here is used for one request and then
// forgotten. We never store it, and every log line goes through `safeLog`,
// which blanks the key out in case a provider echoes it back.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { AGENT_RESULT_JSON_SCHEMA } from "./agent-schema";
import { parseUserKey, PROVIDERS, type ProviderId } from "./ai-providers";

// The instructions the AI gets on every run (same for every provider).
const SYSTEM_PROMPT = `You are the AI teammate on a shared product-design canvas. PMs, designers and developers each leave prompt notes describing what they want. You read ALL the notes together and turn them into simple mobile wireframes.

How to work:
- Find notes that disagree (for example "PM wants a summary on top" vs "designer wants it minimal"). List each disagreement in "conflicts", with the ids of the clashing notes and one plain sentence on why they clash. If nobody disagrees, return an empty list.
- Decide how to merge everyone's wishes. Explain it in "resolution": one short paragraph, written for the whole team, naming whose idea you kept where and why.
- Design the screens. Each screen is a phone-sized wireframe: a name plus components listed top to bottom. Use only these component types: header, text, input, button, card, list, image (an image placeholder), summary (a summary block). Give each a short label, and put extra detail in "notes" (use "" when there's nothing to add).
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
export type BrainJob = { system: string; schema: object; toolName: string; toolDescription: string };

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
// Only Gemini streams today; Claude and OpenAI answer in one go.
export type OnText = (textSoFar: string) => void;

/** Send the message to the chosen provider using `key`. */
export function askBrain(provider: ProviderId, key: string, notesText: string, onText?: OnText, job = WIREFRAME_JOB) {
  if (provider === "anthropic") return askClaude(key, notesText, job);
  if (provider === "openai") return askOpenAI(key, notesText, job);
  return askGemini(key, notesText, onText, job);
}

/**
 * Whose key runs the agent: the person's own key if their browser sent one
 * (used for this one call, never stored), otherwise the app's built-in key
 * from .env.local (Gemini if set, else Claude; AGENT_PROVIDER=anthropic
 * forces Claude). Or a friendly reason it can't run.
 */
export function pickBrain(aiKey: unknown):
  | { provider: ProviderId; key: string; usedOwnKey: boolean }
  | { error: string; status: number } {
  if (aiKey !== undefined && aiKey !== null) {
    const own = parseUserKey(aiKey);
    if ("error" in own) return { error: own.error, status: 400 };
    return { ...own, usedOwnKey: true };
  }
  const usable = (k: string | undefined) => (k && !k.includes("paste_yours_here") ? k : undefined);
  const geminiKey = usable(process.env.GEMINI_API_KEY);
  const claudeKey = usable(process.env.ANTHROPIC_API_KEY);
  const useClaude = process.env.AGENT_PROVIDER === "anthropic" || !geminiKey;
  if (useClaude && !claudeKey) {
    return {
      error:
        "The built-in agent isn't set up: add GEMINI_API_KEY (free, from aistudio.google.com) to .env.local, or add your own key in the 'Your AI key' panel.",
      status: 500,
    };
  }
  return { provider: useClaude ? "anthropic" : "gemini", key: (useClaude ? claudeKey : geminiKey)!, usedOwnKey: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GEMINI — asks for JSON that follows our schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
async function askGemini(key: string, notesText: string, onText: OnText | undefined, job: BrainJob): Promise<BrainReply> {
  let reply: BrainReply = { error: "No Gemini model available.", status: 502 };
  let busy: BrainReply | undefined;
  for (const model of GEMINI_MODELS) {
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
          contents: [{ role: "user", parts: [{ text: userMessage(notesText) }] }],
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
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    safeLog("Gemini returned no text", body, key);
    return { error: "Gemini didn't return any wireframes. Try rewording the notes.", status: 502 };
  }
  return parseJson(text, "Gemini");
}

// Read Gemini's event stream: each "data: {…}" line carries the next bit of
// answer text. Returns the whole answer, parsed, once the stream ends.
async function readGeminiStream(stream: ReadableStream<Uint8Array>, key: string, onText: OnText): Promise<BrainReply> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
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
        const parts = event?.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) if (typeof p?.text === "string") text += p.text;
        onText(text);
      }
    }
  } catch (err) {
    safeLog("Gemini stream broke off", err, key);
    return { error: "The connection to Gemini dropped mid-answer. Please try again.", status: 502 };
  }
  if (!text) return { error: "Gemini didn't return any wireframes. Try rewording the notes.", status: 502 };
  return parseJson(text, "Gemini");
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
async function askClaude(key: string, notesText: string, job: BrainJob): Promise<BrainReply> {
  const client = new Anthropic({ apiKey: key });
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    // Streaming keeps long answers from timing out; finalMessage() waits
    // for the complete answer.
    response = await client.beta.messages
      .stream({
        model: PROVIDERS.anthropic.model,
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
            content: `${userMessage(notesText)}\n\nAnswer by calling ${job.toolName} exactly once.`,
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
// OPENAI — "structured outputs" make the reply follow our schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
async function askOpenAI(key: string, notesText: string, job: BrainJob): Promise<BrainReply> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: PROVIDERS.openai.model,
        messages: [
          { role: "system", content: job.system },
          { role: "user", content: userMessage(notesText) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: job.toolName, strict: true, schema: job.schema },
        },
      }),
    });
  } catch (err) {
    safeLog("OpenAI request failed", err, key);
    return { error: "Couldn't reach OpenAI. Check your internet connection.", status: 502 };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    safeLog(`OpenAI error ${res.status}`, body, key);
    return openAIFailure(res.status, body);
  }

  const message = body?.choices?.[0]?.message;
  if (message?.refusal) {
    return { error: "OpenAI declined these notes. Try rewording them.", status: 422 };
  }
  if (typeof message?.content !== "string") {
    return { error: "OpenAI didn't return any wireframes. Please try again.", status: 502 };
  }
  return parseJson(message.content, "OpenAI");
}

// Turn an OpenAI error into a friendly message (shared with checkKey).
function openAIFailure(status: number, body: unknown): { error: string; status: number } {
  const code = (body as { error?: { code?: string } } | null)?.error?.code;
  if (status === 401 || status === 403) {
    return { error: "OpenAI rejected this API key. Check you copied the whole key from the OpenAI Platform.", status: 401 };
  }
  if (code === "insufficient_quota") {
    return { error: "This OpenAI account is out of credit. Add credits at platform.openai.com → Billing.", status: 402 };
  }
  if (status === 429) {
    return { error: "This OpenAI key is getting too many requests right now. Wait a moment and try again.", status: 429 };
  }
  return { error: "The agent ran into a problem talking to OpenAI. Please try again.", status: 502 };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST KEY — a free call (list the available models) that only succeeds if
// the provider accepts the key. It can't spot an empty credit balance; that
// shows up as a clear error on the first real run instead.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkKey(
  provider: ProviderId,
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (provider === "anthropic") {
      await new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 });
      return { ok: true };
    }

    const res =
      provider === "openai"
        ? await fetch("https://api.openai.com/v1/models", {
            headers: { authorization: `Bearer ${key}` },
          })
        : await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
            headers: { "x-goog-api-key": key },
          });
    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => null);
    safeLog(`${provider} key check failed ${res.status}`, body, key);
    const failure =
      provider === "openai" ? openAIFailure(res.status, body) : geminiFailure(res.status, body);
    return {
      ok: false,
      error: failure?.error ?? `${PROVIDERS[provider].label} didn't accept the key. Please try again.`,
    };
  } catch (err) {
    if (provider === "anthropic") {
      safeLog("anthropic key check failed", err, key);
      return { ok: false, error: claudeFailure(err).error };
    }
    return { ok: false, error: `Couldn't reach ${PROVIDERS[provider].company}. Check your internet connection.` };
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
