"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MY BOARDS — the page at /boards.
//
// Shows every board this person has opened (newest first), lets them make a
// new board, rename one, and open one. The list comes from our own
// /api/boards route (Supabase behind it); the drawings themselves live in
// Liveblocks, inside each room.
//
// "This person" = the identity saved in this browser on the "Who's
// drawing?" screen (lib/user.ts). No identity yet → off to /login.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { loadIdentity, type UserIdentity } from "@/lib/user";
import type { Board } from "@/lib/boards-db";

export default function BoardsPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserIdentity | null>(null);
  const [boards, setBoards] = useState<Board[] | null>(null); // null = loading
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Who's here? (localStorage only exists after the page loads, so read it
  // on the next frame.)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = loadIdentity();
      if (!saved) router.replace("/login");
      else setMe(saved);
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  // Load the list once we know who this is.
  useEffect(() => {
    if (!me) return;
    let current = true;
    fetchBoards(me.id).then(({ boards, error }) => {
      if (!current) return;
      setBoards(boards);
      setError(error);
    });
    return () => {
      current = false;
    };
  }, [me]);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !newName.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: me.id, name: newName }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setCreating(false);
    if (!res?.ok) return setError(data?.error ?? "Couldn't make the board. Please try again.");
    router.push(`/room/${data.board.id}`);
  }

  async function rename(board: Board, name: string) {
    if (!me || !name.trim() || name.trim() === board.name) return;
    setError("");
    const res = await fetch("/api/boards", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: me.id, boardId: board.id, name }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setError(data?.error ?? "Couldn't rename the board. Please try again.");
    setBoards((list) => list?.map((b) => (b.id === board.id ? { ...b, name: name.trim() } : b)) ?? null);
  }

  return (
    <main className="dot-grid min-h-screen px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-heading text-lg tracking-tight">
            <Image src="/logo-2d.png" alt="" width={28} height={28} className="mr-2 inline-block align-middle" />
            Wireframe<span className="text-accent-bright">·</span>Studio
          </Link>
          {me && (
            <Link
              href="/login"
              className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink"
              title="Change your name or color"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: me.color }} />
              {me.name} · {me.role}
            </Link>
          )}
        </header>

        <h1 className="font-heading text-3xl tracking-wide sm:text-4xl">Your boards</h1>
        <p className="mt-1 text-sm text-muted">Every board you&apos;ve opened on this browser. Share a board&apos;s link to bring your team in.</p>

        {/* ── New board ─────────────────────────────────────────────────── */}
        <form onSubmit={createBoard} className="mt-6 flex max-w-lg gap-2">
          <label htmlFor="new-board" className="sr-only">New board name</label>
          <input
            id="new-board"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            placeholder="Name a new board, e.g. Dog walker app"
            className="min-w-0 flex-1 rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent-bright"
          />
          <button
            disabled={!me || creating || !newName.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Making…" : "New board"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-accent-bright" role="alert">{error}</p>}

        {/* ── The list ──────────────────────────────────────────────────── */}
        <section className="mt-8">
          {boards === null && <p className="font-mono text-xs uppercase tracking-widest text-muted">Loading your boards…</p>}
          {boards?.length === 0 && !error && (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              No boards yet. Name one above to start, or open a board link a teammate sent you.
            </div>
          )}
          {boards && boards.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((b) => (
                <BoardCard key={b.id} board={b} onRename={(name) => rename(b, name)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

// Ask our server for this person's boards. Never throws.
async function fetchBoards(userId: string): Promise<{ boards: Board[]; error: string }> {
  const res = await fetch(`/api/boards?userId=${encodeURIComponent(userId)}`).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) return { boards: [], error: data?.error ?? "Couldn't load your boards. Please try again." };
  return { boards: data.boards, error: "" };
}

// One board: click to open, pencil to rename.
function BoardCard({ board, onRename }: { board: Board; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);

  return (
    <li className="group relative rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent-bright">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRename(name);
            setEditing(false);
          }}
        >
          <label htmlFor={`rename-${board.id}`} className="sr-only">Board name</label>
          <input
            id={`rename-${board.id}`}
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              onRename(name);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(board.name);
                setEditing(false);
              }
            }}
            className="w-full rounded-md border border-accent-bright bg-raised px-2 py-1 text-base text-ink outline-none"
          />
        </form>
      ) : (
        <Link href={`/room/${board.id}`} className="block pr-8 after:absolute after:inset-0">
          <span className="block truncate text-base font-medium">{board.name}</span>
        </Link>
      )}
      <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted">
        Opened {timeAgo(board.lastOpenedAt)}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-muted">/room/{board.id}</p>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          aria-label={`Rename ${board.name}`}
          className="absolute right-3 top-3 z-10 rounded p-1 text-muted hover:bg-raised hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          </svg>
        </button>
      )}
    </li>
  );
}

// "3 minutes ago", "yesterday"… in the browser's language.
function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"],
  ];
  let value = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}
