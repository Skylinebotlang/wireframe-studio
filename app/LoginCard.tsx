"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN CARD — the "sign in" form, used in two places:
//   • the landing page (/)            → also asks which room to open
//                                        (left empty → "" → the /boards page)
//   • a direct room link (/room/xyz)  → the room is already known
//
// No passwords: type a name, pick a role and a cursor color, and in.
// The choice is saved in localStorage (see lib/user.ts), so refreshing the
// page or coming back later skips straight past this screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { PEOPLE_COLORS, ROLES } from "@/lib/theme";
import { makeIdentity, saveIdentity, UserIdentity } from "@/lib/user";

type Props = {
  // Known room (direct link). Leave out to show a "room name" field instead.
  roomId?: string;
  // Pre-fill the form when someone is already signed in.
  initial?: UserIdentity | null;
  // The signed-in account's id: becomes this person's id everywhere
  // (cursors, boards), so it's the same on every computer.
  userId?: string;
  // Called after the identity is saved, with the room to open ("" = none).
  onDone: (roomId: string) => void;
};

// Same rule as Liveblocks-friendly room names: simple URL-safe slugs.
const ROOM_PATTERN = /^[a-z0-9_-]{1,64}$/;

export function LoginCard({ roomId, initial, userId, onDone }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<string>(initial?.role ?? ROLES[0]);
  const [colorIndex, setColorIndex] = useState(() => {
    const i = PEOPLE_COLORS.findIndex((c) => c === initial?.color);
    return i >= 0 ? i : 0;
  });
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (name.trim().length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }
    const target = roomId ?? room.trim().toLowerCase();
    if (target && !ROOM_PATTERN.test(target)) {
      setError("Room names use letters, numbers, dashes or underscores only.");
      return;
    }
    // Build the identity, save it for next time, and continue.
    const made = makeIdentity(name, role, colorIndex);
    saveIdentity(userId ? { ...made, id: userId } : made);
    onDone(target);
  }

  // Enter anywhere in the form submits it.
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && submit();

  return (
    <div className="glass pop-in w-full max-w-sm rounded-xl p-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
        {roomId ? "Joining room" : "Sign in"}
      </p>
      <h2 className="mt-1 neon-text font-heading text-2xl font-semibold text-ink">
        {roomId ?? "Who's drawing?"}
      </h2>

      {/* Name */}
      <label htmlFor="login-name" className="mt-6 block font-mono text-[11px] uppercase tracking-widest text-muted">
        Your name
      </label>
      <input
        id="login-name"
        className="mt-1.5 w-full rounded-md border border-line bg-raised px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-accent-bright"
        placeholder="e.g. Asha"
        value={name}
        maxLength={24}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={onEnter}
        // Focus the name field on room links; on the landing page it would
        // scroll past the headline on small screens.
        autoFocus={!!roomId}
      />

      {/* Role */}
      <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted">Your role</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => setRole(r)}
            className={`rounded-md border px-2 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
              role === r
                ? "border-accent-bright bg-accent text-ink"
                : "border-line bg-raised text-ink hover:border-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Cursor color */}
      <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted">Cursor color</p>
      <div className="mt-1.5 flex gap-2">
        {PEOPLE_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-label={`Choose color ${i + 1}`}
            aria-pressed={colorIndex === i}
            onClick={() => setColorIndex(i)}
            className={`h-7 w-7 rounded-full transition-transform ${
              colorIndex === i ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Room name — only on the landing page */}
      {!roomId && (
        <>
          <label htmlFor="login-room" className="mt-4 block font-mono text-[11px] uppercase tracking-widest text-muted">
            Room
          </label>
          <input
            id="login-room"
            className="mt-1.5 w-full rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-muted focus:border-accent-bright"
            placeholder="optional · empty = your boards"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
          />
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-bright">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-6 w-full rounded-md bg-accent py-2.5 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-125"
      >
        {roomId ? "Enter the room →" : room.trim() ? "Open the canvas →" : "See your boards →"}
      </button>

      <p className="mt-3 text-center font-mono text-[11px] text-muted">
        Everyone in the room sees your name on your cursor.
      </p>
    </div>
  );
}
