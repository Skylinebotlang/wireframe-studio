"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "YOUR AI KEY": a key icon that opens a small settings panel.
//
// In the panel a person can:
//   • pick a provider (Gemini, Claude or OpenAI)
//   • paste their API key and press "Test & save" (we check it works first)
//   • see which provider/model is active, and remove the key
//
// The key is saved only in this browser (see lib/byok.ts), shown masked,
// and never shared with the room.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/ai-providers";
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
  const [provider, setProvider] = useState<ProviderId>(saved?.provider ?? "gemini");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "testing" | "ok" | "error"; text?: string }>({
    kind: "idle",
  });
  const info = PROVIDERS[provider];

  // Close with the Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function testAndSave() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setStatus({ kind: "testing" });
    try {
      const res = await fetch("/api/agent/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiKey: { provider, key: trimmed } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", text: data.error ?? "That key didn't work." });
        return;
      }
      saveAiKey({ provider, key: trimmed });
      setKey(""); // don't leave the raw key sitting in the input
      setStatus({ kind: "ok", text: data.message });
    } catch {
      setStatus({ kind: "error", text: "Couldn't reach the server. Is the app running?" });
    }
  }

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
              Active: <span className="text-ink">{PROVIDERS[saved.provider].label}</span> ·{" "}
              {PROVIDERS[saved.provider].model}
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
          <div className="text-muted">
            No key added. The agent uses the app&apos;s built-in free Gemini agent.
          </div>
        )}
      </div>

      {/* Pick a provider */}
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">Provider</div>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {PROVIDER_IDS.map((id) => (
          <button
            key={id}
            onClick={() => {
              setProvider(id);
              setStatus({ kind: "idle" });
            }}
            aria-pressed={provider === id}
            className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
              provider === id
                ? "border-accent-bright bg-accent text-ink"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {PROVIDERS[id].label}
          </button>
        ))}
      </div>

      {/* Paste the key */}
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted" htmlFor="ai-key-input">
        {info.company} API key
      </label>
      <input
        id="ai-key-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setStatus({ kind: "idle" });
        }}
        onKeyDown={(e) => e.key === "Enter" && testAndSave()}
        placeholder={`${info.keyPrefix}…`}
        className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent-bright"
      />
      <button
        onClick={testAndSave}
        disabled={!key.trim() || status.kind === "testing"}
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
        Get a key from{" "}
        {PROVIDER_IDS.map((id, i) => (
          <span key={id}>
            <a href={PROVIDERS[id].keyUrl} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
              {PROVIDERS[id].keySite}
            </a>
            {i < PROVIDER_IDS.length - 2 ? ", " : i === PROVIDER_IDS.length - 2 ? " or " : "."}
          </span>
        ))}{" "}
        Your key stays in this browser and is never shared with the room.
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
