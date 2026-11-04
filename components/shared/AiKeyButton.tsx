"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "YOUR AI KEY": a key icon that opens a small settings panel.
//
// In the panel a person can:
//   • paste ANY supported AI key into one box: the service is recognised
//     from how the key starts (lib/ai-providers.ts detectProvider); when it
//     can't be (e.g. plain "sk-…"), they pick it from the list
//   • optionally type a model name (else the service's default model)
//   • press "Test & save" (we check it works first)
//   • see which provider/model is active, and remove the key
//
// The key is saved only in this browser (see lib/byok.ts), shown masked,
// and never shared with the room.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { detectProvider, modelFor, PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/ai-providers";
import { CHANGE_EVENT, clearAiKey, loadAiKey, maskKey, saveAiKey, type SavedAiKey } from "@/lib/byok";

/** Keeps a component in sync with the saved key (this tab and other tabs). */
export function useSavedAiKey(): SavedAiKey | null {
  const [saved, setSaved] = useState<SavedAiKey | null>(null);
  useEffect(() => {
    const refresh = () => setSaved(loadAiKey());
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh); // another tab changed it
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return saved;
}

export function AiKeyButton({ className = "" }: { className?: string }) {
  const saved = useSavedAiKey();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Your AI key"
        aria-expanded={open}
        title={saved ? `Your AI key: ${PROVIDERS[saved.provider].label}` : "Your AI key"}
        className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-ink transition-colors hover:bg-raised"
      >
        <KeyIcon />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {saved ? PROVIDERS[saved.provider].label : "Key"}
        </span>
        {/* Small wine dot = this person has their own key active. */}
        {saved && <span className="h-1.5 w-1.5 rounded-full bg-accent-bright" />}
      </button>

      {open && <AiKeyPanel saved={saved} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AiKeyPanel({ saved, onClose }: { saved: SavedAiKey | null; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState<ProviderId | "">(saved?.provider ?? "");
  const [model, setModel] = useState(saved?.model ?? "");
  const [status, setStatus] = useState<{ kind: "idle" | "testing" | "ok" | "error"; text?: string }>({
    kind: "idle",
  });
  const info = provider ? PROVIDERS[provider] : null;
  const trimmed = key.trim();
  // We can't tell the service from this key (e.g. plain "sk-…"): ask which.
  const askWhich = !!trimmed && !detectProvider(trimmed) && !provider;

  // Close with the Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function testAndSave() {
    if (!trimmed || !provider) return;
    const aiKey = { provider, key: trimmed, ...(model.trim() ? { model: model.trim() } : {}) };
    setStatus({ kind: "testing" });
    try {
      const res = await fetch("/api/agent/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", text: data.error ?? "That key didn't work." });
        return;
      }
      saveAiKey(aiKey);
      setKey(""); // don't leave the raw key sitting in the input
      setStatus({ kind: "ok", text: data.message });
    } catch {
      setStatus({ kind: "error", text: "Couldn't reach the server. Is the app running?" });
    }
  }

  const label = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted";
  const field =
    "mb-3 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent-bright";

  return (
    <div
      role="dialog"
      aria-label="Your AI key"
      className="glass pop-in absolute right-0 top-10 z-[60] w-80 rounded-lg border border-line p-4 text-left text-ink shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm tracking-wide">Your AI key</h2>
        <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
          ×
        </button>
      </div>

      {/* What's active right now */}
      <div className="mb-4 rounded-md bg-raised px-3 py-2 font-mono text-[11px] leading-relaxed">
        {saved ? (
          <>
            <div>
              Active: <span className="text-ink">{PROVIDERS[saved.provider].label}</span> · {modelFor(saved)}
            </div>
            <div className="text-muted">Key {maskKey(saved.key)} · saved in this browser only</div>
            <button
              onClick={() => {
                clearAiKey();
                setStatus({ kind: "idle" });
              }}
              className="mt-1 text-accent-bright underline-offset-2 hover:underline"
            >
              Remove my key
            </button>
          </>
        ) : (
          <div className="text-muted">No key added yet. The agent needs your own key to run.</div>
        )}
      </div>

      {/* Paste any key: the service is picked for you when we can tell */}
      <label className={label} htmlFor="ai-key-input">
        API key
      </label>
      <input
        id="ai-key-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          const found = detectProvider(e.target.value);
          if (found) setProvider(found);
          setStatus({ kind: "idle" });
        }}
        onKeyDown={(e) => e.key === "Enter" && testAndSave()}
        placeholder="Paste a key from any supported AI service"
        className={field}
      />

      <label className={label} htmlFor="ai-provider-select">
        Service
      </label>
      <select
        id="ai-provider-select"
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as ProviderId | "");
          setStatus({ kind: "idle" });
        }}
        className={`${field} ${askWhich ? "border-accent-bright" : ""}`}
      >
        <option value="">Pick your service…</option>
        {PROVIDER_IDS.map((id) => (
          <option key={id} value={id}>
            {PROVIDERS[id].label}
            {PROVIDERS[id].label === PROVIDERS[id].company ? "" : ` (${PROVIDERS[id].company})`}
          </option>
        ))}
      </select>
      {askWhich && (
        <p className="-mt-2 mb-3 text-[11px] leading-relaxed text-muted" role="status">
          We can&apos;t tell which service this key is from
          {trimmed.startsWith("sk-") ? " (OpenAI, DeepSeek, Kimi and Qwen keys all start with sk-)" : ""}. Pick it above.
        </p>
      )}

      <label className={label} htmlFor="ai-model-input">
        Model <span className="normal-case tracking-normal">(optional)</span>
      </label>
      <input
        id="ai-model-input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={model}
        onChange={(e) => {
          setModel(e.target.value);
          setStatus({ kind: "idle" });
        }}
        onKeyDown={(e) => e.key === "Enter" && testAndSave()}
        placeholder={info ? `Default: ${info.model}` : "Default model for the service"}
        className={field}
      />

      <button
        onClick={testAndSave}
        disabled={!trimmed || !provider || status.kind === "testing"}
        className="w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:brightness-110 disabled:opacity-50"
      >
        {status.kind === "testing" ? "Testing…" : "Test & save key"}
      </button>

      {status.text && (
        <p className={`mt-2 text-xs ${status.kind === "ok" ? "text-ink" : "text-accent-bright"}`} role="status">
          {status.kind === "ok" ? "✓ " : "⚠ "}
          {status.text}
        </p>
      )}

      {/* Where keys come from */}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {info ? (
          <>
            Get a {info.company} key at{" "}
            <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
              {info.keySite}
            </a>
            .{" "}
          </>
        ) : (
          <>Works with Gemini, Claude, OpenAI, Groq, OpenRouter, Grok, DeepSeek, Kimi, Mistral and more. </>
        )}
        Your key is saved only in this browser, sent to our server only for your own AI requests, and never shared with the
        room.
      </p>
    </div>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2M16 7l3 3M14 9l2 2" />
    </svg>
  );
}
