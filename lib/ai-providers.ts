// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDERS — the three "brains" a user can plug their own key into.
//
// Plain data only (no secrets), so both the browser (key panel) and the
// server (agent route) can import it.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_IDS = ["gemini", "anthropic", "openai"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDERS: Record<
  ProviderId,
  {
    label: string; // shown in the UI and the activity feed, e.g. "Claude"
    company: string; // e.g. "Anthropic"
    model: string; // the model we run for this provider
    keyUrl: string; // where to get a key
    keySite: string; // human name of that page
    keyPrefix: string; // what a real key usually starts with (a hint only)
  }
> = {
  gemini: {
    label: "Gemini",
    company: "Google",
    model: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keySite: "Google AI Studio",
    keyPrefix: "AIza",
  },
  anthropic: {
    label: "Claude",
    company: "Anthropic",
    model: "claude-sonnet-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keySite: "Anthropic Console",
    keyPrefix: "sk-ant-",
  },
  openai: {
    label: "OpenAI",
    company: "OpenAI",
    model: "gpt-6.1-sol",
    keyUrl: "https://platform.openai.com/api-keys",
    keySite: "OpenAI Platform",
    keyPrefix: "sk-",
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

/** Check the { provider, key } object a browser sent. */
export function parseUserKey(
  value: unknown
): { provider: ProviderId; key: string } | { error: string } {
  const { provider, key } = (value ?? {}) as { provider?: unknown; key?: unknown };
  if (!isProviderId(provider)) {
    return { error: "Unknown AI provider. Pick Gemini, Claude or OpenAI in the 'Your AI key' panel." };
  }
  if (typeof key !== "string" || key.trim().length < 10 || key.length > 400 || /\s/.test(key.trim())) {
    return { error: `That doesn't look like a ${PROVIDERS[provider].label} key. Paste it again in the 'Your AI key' panel.` };
  }
  return { provider, key: key.trim() };
}

// Info about who/what ran an agent run. The server adds this to every
// successful answer so the activity feed can say "Run by papi using Claude".
// It never contains the key.
export type AgentRunInfo = {
  provider: ProviderId;
  providerLabel: string; // "Gemini" | "Claude" | "OpenAI"
  usedOwnKey: boolean; // false = the app's built-in free agent
};
