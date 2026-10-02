"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY GATE — the "who are you?" screen before entering a room.
//
// No passwords: type a name, pick a role and a cursor color, and in.
// The choice is saved in localStorage, so refreshing the page or reopening
// the room later skips straight past this screen.
//
// Why role and color matter: Milestone 2 prints your role on prompt notes,
// and the cursor colors are how everyone tells each other apart.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { PEOPLE_COLORS, ROLES } from "@/lib/theme";
import { makeIdentity, saveIdentity } from "@/lib/user";

export function IdentityGate({
  roomId,
  onJoin,
}: {
  roomId: string;
  onJoin: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(ROLES[0]);
  const [colorIndex, setColorIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function join() {
    if (name.trim().length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }
    // Build the identity, save it for next time, and continue into the room.
    const identity = makeIdentity(name, role, colorIndex);
    saveIdentity(identity);
    onJoin();
  }

  return (
    <div className="dot-grid flex h-screen w-screen items-center justify-center p-6">
      <div className="glass pop-in w-full max-w-sm rounded-xl p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
          Joining room
        </p>
        <h1 className="mt-1 neon-text font-heading text-2xl font-semibold text-ink">
          {roomId}
        </h1>

        {/* Name */}
        <label className="mt-6 block font-mono text-[11px] uppercase tracking-widest text-muted">
          Your name
        </label>
        <input
          className="mt-1.5 w-full rounded-md border border-line bg-raised px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-accent"
          placeholder="e.g. Asha"
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && join()}
          autoFocus
        />

        {/* Role */}
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-widest text-muted">
          Your role
        </label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md border px-2 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
                role === r
                  ? "border-accent bg-accent text-ink"
                  : "border-line bg-raised text-ink hover:border-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Cursor color */}
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-widest text-muted">
          Cursor color
        </label>
        <div className="mt-1.5 flex gap-2">
          {PEOPLE_COLORS.map((c, i) => (
            <button
              key={c}
              aria-label={`Choose color ${i + 1}`}
              onClick={() => setColorIndex(i)}
              className={`h-7 w-7 rounded-full transition-transform ${
                colorIndex === i
                  ? "ring-2 ring-ink ring-offset-2 ring-offset-paper"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-agent">{error}</p>}

        <button
          onClick={join}
          className="mt-6 w-full rounded-md bg-accent py-2.5 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-110"
        >
          Enter the room →
        </button>

        <p className="mt-3 text-center font-mono text-[11px] text-muted">
          Everyone in this room sees your name on your cursor.
        </p>
      </div>
    </div>
  );
}
