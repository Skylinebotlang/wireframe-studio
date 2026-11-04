// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDERS — every "brain" a user can plug their own key into.
//
// Gemini and Claude have their own connection code. Every other provider
// "speaks OpenAI" (same request shape), so it only needs its web address
// (`baseUrl`) and a default model here: lib/agent/agent-brains.ts reuses one
// connection for all of them.
//
// The key panel has ONE key box: `detectProvider` recognises most keys from
// how they start; for the rest (e.g. plain "sk-…") the person picks the
// service from the list. Each provider has a good default model; people may
// type another model name instead (optional box).
//
// Plain data only (no secrets), so both the browser (key panel) and the
// server (agent route) can import it. Self-check: lib/ai-providers.check.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_IDS = [
  "gemini",
  "anthropic",
  "openai",
  "groq",
  "openrouter",
  "xai",
  "cerebras",
  "fireworks",
  "huggingface",
  "deepseek",
  "kimi",
  "qwen",
  "mistral",
  "together",
  "deepinfra",
  "sambanova",
  "zhipu",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

type Provider = {
  label: string; // shown in the UI and the activity feed, e.g. "Claude"
  company: string; // e.g. "Anthropic"
  model: string; // the default model we run for this provider
  keyUrl: string; // where to get a key
  keySite: string; // human name of that page
  keyPrefix: string; // what a real key usually starts with (a hint only; "" = no pattern)
  detect?: string[]; // key starts that ONLY this provider uses (auto-detect)
  baseUrl?: string; // OpenAI-compatible web address (all but Gemini and Claude)
  checkUrl?: string; // where to test the key, when `${baseUrl}/models` doesn't need one ("chat" = a 1-word chat)
};

// ponytail: default models picked 2026-11; if one is retired, the key test
// warns and people can type a newer one in the model box. Update here.
export const PROVIDERS: Record<ProviderId, Provider> = {
  gemini: {
    label: "Gemini",
    company: "Google",
    model: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keySite: "Google AI Studio",
    keyPrefix: "AIza",
    detect: ["AIza"],
  },
  anthropic: {
    label: "Claude",
    company: "Anthropic",
    model: "claude-sonnet-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keySite: "Anthropic Console",
    keyPrefix: "sk-ant-",
    detect: ["sk-ant-"],
  },
  openai: {
    label: "OpenAI",
    company: "OpenAI",
    model: "gpt-6.1-sol",
    keyUrl: "https://platform.openai.com/api-keys",
    keySite: "OpenAI Platform",
    keyPrefix: "sk-",
    detect: ["sk-proj-", "sk-svcacct-"],
    baseUrl: "https://api.openai.com/v1",
  },
  groq: {
    label: "Groq",
    company: "Groq",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://console.groq.com/keys",
    keySite: "GroqCloud",
    keyPrefix: "gsk_",
    detect: ["gsk_"],
    baseUrl: "https://api.groq.com/openai/v1",
  },
  openrouter: {
    label: "OpenRouter",
    company: "OpenRouter",
    model: "openai/gpt-5-mini",
    keyUrl: "https://openrouter.ai/settings/keys",
    keySite: "OpenRouter",
    keyPrefix: "sk-or-",
    detect: ["sk-or-"],
    baseUrl: "https://openrouter.ai/api/v1",
    checkUrl: "https://openrouter.ai/api/v1/key", // its model list is public
  },
  xai: {
    label: "Grok",
    company: "xAI",
    model: "grok-4.1-fast",
    keyUrl: "https://console.x.ai",
    keySite: "xAI Console",
    keyPrefix: "xai-",
    detect: ["xai-"],
    baseUrl: "https://api.x.ai/v1",
  },
  cerebras: {
    label: "Cerebras",
    company: "Cerebras",
    model: "gpt-oss-120b",
    keyUrl: "https://cloud.cerebras.ai",
    keySite: "Cerebras Cloud",
    keyPrefix: "csk-",
    detect: ["csk-"],
    baseUrl: "https://api.cerebras.ai/v1",
  },
  fireworks: {
    label: "Fireworks",
    company: "Fireworks AI",
    model: "accounts/fireworks/models/gpt-oss-120b",
    keyUrl: "https://fireworks.ai/account/api-keys",
    keySite: "Fireworks",
    keyPrefix: "fw_",
    detect: ["fw_"],
    baseUrl: "https://api.fireworks.ai/inference/v1",
  },
  huggingface: {
    label: "Hugging Face",
    company: "Hugging Face",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://huggingface.co/settings/tokens",
    keySite: "Hugging Face",
    keyPrefix: "hf_",
    detect: ["hf_"],
    baseUrl: "https://router.huggingface.co/v1",
    checkUrl: "https://huggingface.co/api/whoami-v2",
  },
  deepseek: {
    label: "DeepSeek",
    company: "DeepSeek",
    model: "deepseek-flash",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keySite: "DeepSeek Platform",
    keyPrefix: "sk-",
    baseUrl: "https://api.deepseek.com",
  },
  kimi: {
    label: "Kimi",
    company: "Moonshot AI",
    model: "kimi-k3",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    keySite: "Moonshot Platform",
    keyPrefix: "sk-",
    baseUrl: "https://api.moonshot.ai/v1",
  },
  qwen: {
    label: "Qwen",
    company: "Alibaba Cloud",
    model: "qwen-plus",
    keyUrl: "https://modelstudio.console.alibabacloud.com/?tab=playground#/api-key",
    keySite: "Alibaba Model Studio",
    keyPrefix: "sk-",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  mistral: {
    label: "Mistral",
    company: "Mistral AI",
    model: "mistral-medium-latest",
    keyUrl: "https://console.mistral.ai/api-keys",
    keySite: "Mistral Console",
    keyPrefix: "",
    baseUrl: "https://api.mistral.ai/v1",
  },
  together: {
    label: "Together",
    company: "Together AI",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://api.together.ai/settings/api-keys",
    keySite: "Together AI",
    keyPrefix: "",
    baseUrl: "https://api.together.xyz/v1",
  },
  deepinfra: {
    label: "DeepInfra",
    company: "DeepInfra",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://deepinfra.com/dash/api_keys",
    keySite: "DeepInfra",
    keyPrefix: "",
    baseUrl: "https://api.deepinfra.com/v1/openai",
  },
  sambanova: {
    label: "SambaNova",
    company: "SambaNova",
    model: "gpt-oss-120b",
    keyUrl: "https://cloud.sambanova.ai/apis",
    keySite: "SambaNova Cloud",
    keyPrefix: "",
    baseUrl: "https://api.sambanova.ai/v1",
    checkUrl: "chat", // its model list is public
  },
  zhipu: {
    label: "GLM",
    company: "Z.ai (Zhipu)",
    model: "glm-5.2",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keySite: "Z.ai",
    keyPrefix: "",
    baseUrl: "https://api.z.ai/api/paas/v4",
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

/**
 * Which provider a key belongs to, from how it starts, or null when we
 * can't tell (plain "sk-…" is used by OpenAI, DeepSeek, Kimi and Qwen; some
 * keys have no pattern at all). We never guess by sending the key to
 * services it might not belong to: the person picks instead.
 */
export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  let best: { id: ProviderId; len: number } | null = null;
  for (const id of PROVIDER_IDS) {
    for (const start of PROVIDERS[id].detect ?? []) {
      if (k.startsWith(start) && start.length > (best?.len ?? 0)) best = { id, len: start.length };
    }
  }
  return best?.id ?? null;
}

// A model name someone typed: letters, digits and . _ : / @ - only.
const MODEL_NAME = /^[A-Za-z0-9._:/@-]{1,120}$/;

export type UserKey = { provider: ProviderId; key: string; model?: string };

/** Check the { provider, key, model? } object a browser sent. */
export function parseUserKey(value: unknown): UserKey | { error: string } {
  const { provider, key, model } = (value ?? {}) as { provider?: unknown; key?: unknown; model?: unknown };
  if (!isProviderId(provider)) {
    return { error: "Unknown AI provider. Pick your service in the 'Your AI key' panel." };
  }
  if (typeof key !== "string" || key.trim().length < 10 || key.length > 400 || /\s/.test(key.trim())) {
    return { error: `That doesn't look like a ${PROVIDERS[provider].label} key. Paste it again in the 'Your AI key' panel.` };
  }
  if (model !== undefined && model !== "" && (typeof model !== "string" || !MODEL_NAME.test(model.trim()))) {
    return { error: "That model name has unusual characters. Check it in the 'Your AI key' panel." };
  }
  const m = typeof model === "string" ? model.trim() : "";
  return { provider, key: key.trim(), ...(m ? { model: m } : {}) };
}

/** The model a key will run: the one the person typed, or the provider's default. */
export const modelFor = (k: Pick<UserKey, "provider" | "model">) => k.model || PROVIDERS[k.provider].model;

// Info about who/what ran an agent run. The server adds this to every
// successful answer so the activity feed can say "Run by papi using Claude".
// It never contains the key.
export type AgentRunInfo = {
  provider: ProviderId;
  providerLabel: string; // e.g. "Gemini", "Groq"
  usedOwnKey: boolean; // always true now: the AI only runs on the person's own key
};

/** Shown when someone tries the AI without adding their own key (there is no app key). */
export const NEED_OWN_KEY =
  "Add your own AI key first: open “Your AI key” in the top bar and paste a key from Gemini, Claude, OpenAI, Groq, OpenRouter or another supported service.";
