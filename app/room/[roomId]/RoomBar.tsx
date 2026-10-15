"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM BAR — what the top bar shows inside a board:
//   • the board's name and YOUR role on it (Owner / Editor / Contributor / Viewer)
//   • Team  → the people on this board, in two groups: ONLINE (has the board
//             open right now, green dot) and OFFLINE (grey dot, "Last seen …").
//             The owner (one per board) changes anyone's role from a menu, or
//             hands the board over ("Make owner…"); everyone else just sees
//             the roles. Changes show at once ("Saving…" → "Saved"), and
//             reach the other person live (lib/board-role.ts).
//   • Share → copy the board's link (new people join as viewers)
// Decisions show as the "Clashes in the last run" card in the agent panel.
// Roles are decided and enforced on the server (lib/roles.ts, lib/boards-db.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar, BarButton } from "../../TopBar";
import type { useBoardTeam } from "@/lib/board-role";
import type { Role } from "@/lib/roles";

type Team = ReturnType<typeof useBoardTeam>;
type Member = Team["members"][number];

const LABEL: Record<Role, string> = { owner: "Owner", editor: "Editor", contributor: "Contributor", viewer: "Viewer" };
// What the owner can pick in a role menu (owner is "Make owner…", below).
const CHOICES: { role: Exclude<Role, "owner">; hint: string }[] = [
  { role: "editor", hint: "Draws and runs the AI" },
  { role: "contributor", hint: "Draws and adds notes, no AI" },
  { role: "viewer", hint: "Can only look" },
];
const EXIT_MS = 140; // matches .team-out in globals.css
const SAVED_MS = 2000; // how long "Saved · now Editor" stays
const COPIED_MS = 2000; // how long "Link copied" stays
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright";

export function RoomBar({ team, myId, colorOf }: { team: Team; myId: string; colorOf: (name: string) => string }) {
  const { roomId } = useParams<{ roomId: string }>();
  const [copied, setCopied] = useState(false);
  const teamList = useClosable();
  const { hide: hideTeam } = teamList;
  const teamButton = useRef<HTMLButtonElement>(null);
  const teamArea = useRef<HTMLDivElement>(null);

  // Closing puts focus back on the Team button.
  const closeTeam = useCallback(() => {
    hideTeam();
    teamButton.current?.focus();
  }, [hideTeam]);

  async function share() {
    if (await copyLink()) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const shown = teamList.open && !teamList.leaving;
  return (
    <TopBar>
      <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
      <h1 className="min-w-0 truncate font-mono text-xs text-ink" title={roomId}>
        {roomId}
      </h1>
      {team.me && (
        <span className="shrink-0 rounded-full border border-accent-bright/60 px-2 py-0.5 text-[11px] text-wine-light">
          {LABEL[team.me]}
        </span>
      )}
      {/* The owner just changed my role: say so for a few seconds. */}
      {team.notice && (
        <span role="status" className="pop-in shrink-0 text-[11px] text-wine-light">
          {team.notice}
        </span>
      )}
      <span className="flex-1" />
      <div ref={teamArea} className="relative">
        <BarButton
          ref={teamButton}
          icon={<PeopleIcon />}
          label="Team"
          popup="dialog"
          active={shown}
          onClick={() => (shown ? closeTeam() : teamList.show())}
        />
        {teamList.open && (
          <TeamPopup team={team} myId={myId} colorOf={colorOf} leaving={teamList.leaving} area={teamArea} onClose={closeTeam} />
        )}
      </div>
      <BarButton icon={<LinkIcon />} label={copied ? "Link copied ✓" : "Share"} strong onClick={share} />
    </TopBar>
  );
}

// ── The Team popup ───────────────────────────────────────────────────────────

// What a row shows while (or just after) the owner changes that person's role.
type RowState = { role?: Role; note?: "saving" | "saved" | "error"; text?: string };

function TeamPopup({
  team,
  myId,
  colorOf,
  leaving,
  area,
  onClose,
}: {
  team: Team;
  myId: string;
  colorOf: (n: string) => string;
  leaving: boolean;
  area: React.RefObject<HTMLDivElement | null>; // the Team button + this popup: clicks inside don't close it
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const owner = team.me === "owner";
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [copied, setCopied] = useState(false);
  const setRow = (userId: string, state: RowState) => setRows((r) => ({ ...r, [userId]: state }));

  // The role menu: which row it's open on, and that row's button (the menu
  // sits under it, and focus goes back to it when the menu closes).
  const menu = useClosable();
  const { hide: hideMenu } = menu;
  const [menuFor, setMenuFor] = useState<{ m: Member; button: HTMLButtonElement } | null>(null);
  const closeMenu = useCallback(() => {
    hideMenu();
    menuFor?.button.focus();
  }, [hideMenu, menuFor]);

  // Focus moves into the popup when it opens.
  useEffect(() => {
    box.current?.focus();
  }, []);

  // Esc and a click outside close it. (Esc inside the role menu only closes
  // the menu: the menu stops the key from reaching here.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => !area.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose, area]);

  // Optimistic: the new role shows at once, then "Saving…" → "Saved · now X",
  // or back to the old role with the server's reason.
  async function change(m: Member, role: Role) {
    if (role === m.role) return;
    // One owner per board: making someone owner hands the board over.
    if (role === "owner" && !window.confirm(`Make ${m.name} the owner of this board? You'll become an editor.`)) return;
    setRow(m.userId, { role, note: "saving" });
    const problem = await team.setRole(m.userId, role);
    if (problem) {
      setRow(m.userId, { note: "error", text: problem });
      return;
    }
    setRow(m.userId, { note: "saved", text: `Saved · now ${LABEL[role]}` });
    setTimeout(() => setRows((r) => (r[m.userId]?.note === "saved" ? { ...r, [m.userId]: {} } : r)), SAVED_MS);
  }

  async function copy() {
    if (await copyLink()) {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    }
  }

  // Online first, then offline; the owner first in their group, then A→Z.
  const onlineIds = new Set(team.online);
  const order = (a: Member, b: Member) =>
    a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const here = team.members.filter((m) => onlineIds.has(m.userId)).sort(order);
  const away = team.members.filter((m) => !onlineIds.has(m.userId)).sort(order);

  const row = (m: Member, isHere: boolean) => (
    <MemberRow
      key={m.userId}
      m={m}
      here={isHere}
      mine={m.userId === myId}
      canChange={owner}
      colorOf={colorOf}
      state={rows[m.userId] ?? {}}
      menuOpen={menu.open && !menu.leaving && menuFor?.m.userId === m.userId}
      onToggleMenu={(button) => {
        if (menu.open && !menu.leaving && menuFor?.m.userId === m.userId) return closeMenu();
        setMenuFor({ m, button });
        menu.show();
      }}
    />
  );

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Team"
      tabIndex={-1}
      className={`absolute right-0 top-[calc(100%+8px)] z-[1000] w-[340px] max-w-[calc(100vw-32px)] origin-top-right rounded-xl border border-line bg-surface pt-2 text-ink shadow-[0_18px_48px_rgba(0,0,0,0.5)] outline-none ${leaving ? "team-out" : "team-in"}`}
    >
      {/* Header: title + count, close button. */}
      <div className="flex items-center justify-between pl-4 pr-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">Team</h2>
          <span className="rounded-full border border-line bg-raised px-2 py-px font-mono text-xs text-muted">
            {team.members.length}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close team list"
          onClick={onClose}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink ${FOCUS}`}
        >
          <CloseIcon />
        </button>
      </div>

      {/* The people. Scrolls when the team is long (the role menu closes then,
          since it's placed against the screen). */}
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto" onScroll={() => menu.open && closeMenu()}>
        {here.length > 0 && <GroupLabel>Online · {here.length}</GroupLabel>}
        {here.length > 0 && <ul>{here.map((m) => row(m, true))}</ul>}
        {away.length > 0 && <GroupLabel second={here.length > 0}>Offline · {away.length}</GroupLabel>}
        {away.length > 0 && <ul>{away.map((m) => row(m, false))}</ul>}
      </div>

      {/* Footer: who new people join as (owner) or why you can't change roles,
          then the invite link. */}
      <div className="mt-2 flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3.5">
        {owner ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">New people join as</span>
            <span className="flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] text-ink">Viewer</span>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <InfoIcon /> Only the owner can change roles.
          </p>
        )}
        <button
          type="button"
          onClick={copy}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${
            owner ? "bg-accent text-ink hover:brightness-125" : "border border-line text-ink hover:bg-raised"
          } ${FOCUS}`}
        >
          <LinkIcon /> {copied ? "Link copied" : "Copy invite link"}
        </button>
      </div>

      {menu.open && menuFor && (
        <RoleMenu
          anchor={menuFor.button}
          current={(rows[menuFor.m.userId]?.role ?? menuFor.m.role) as Exclude<Role, "owner">}
          leaving={menu.leaving}
          onClose={closeMenu}
          onPick={(role) => {
            closeMenu();
            change(menuFor.m, role);
          }}
        />
      )}
    </div>
  );
}

function GroupLabel({ children, second }: { children: React.ReactNode; second?: boolean }) {
  return (
    <p className={`px-4 pb-1 ${second ? "pt-3.5" : "pt-2.5"} font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted`}>
      {children}
    </p>
  );
}

function MemberRow({
  m,
  here,
  mine,
  canChange,
  colorOf,
  state,
  menuOpen,
  onToggleMenu,
}: {
  m: Member;
  here: boolean;
  mine: boolean;
  canChange: boolean; // I'm the owner
  colorOf: (n: string) => string;
  state: RowState;
  menuOpen: boolean;
  onToggleMenu: (button: HTMLButtonElement) => void;
}) {
  const role = state.role ?? m.role; // optimistic while saving
  const status = here ? "Online now" : m.lastOpenedAt ? `Last seen ${timeAgo(m.lastOpenedAt)}` : "Offline";
  return (
    <li className={`group flex min-h-[52px] items-center gap-3 px-4 py-2 transition-colors hover:bg-raised ${menuOpen ? "bg-raised" : ""}`}>
      {/* Avatar with a status dot (its border matches the row behind it). */}
      <span className="relative shrink-0">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold uppercase text-paper"
          style={{ backgroundColor: colorOf(m.name) }}
          aria-hidden
        >
          {m.name.charAt(0)}
        </span>
        <span
          className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 ${here ? "bg-online" : "bg-offline"} ${
            menuOpen ? "border-raised" : "border-surface group-hover:border-raised"
          }`}
          aria-hidden
        />
      </span>

      {/* Name (+ YOU) and status, or what's happening with a role change. */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{m.name}</span>
          {mine && (
            <span className="shrink-0 rounded-full border border-line px-1.5 font-mono text-[10px] leading-4 text-wine-light">YOU</span>
          )}
        </span>
        <span className="block truncate text-xs" aria-live="polite">
          {state.note === "saving" ? (
            <span className="text-muted">Saving…</span>
          ) : state.note === "saved" ? (
            <span className="inline-flex items-center gap-1 text-online">
              <CheckIcon /> {state.text}
            </span>
          ) : state.note === "error" ? (
            <span className="text-rose">{state.text}</span>
          ) : (
            <span className="text-muted">{status}</span>
          )}
        </span>
      </span>

      {/* Role: the owner's is fixed; the owner can change everyone else's. */}
      {m.role === "owner" ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
          <LockIcon /> Owner
        </span>
      ) : canChange ? (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Role for ${m.name}: ${LABEL[role]}`}
          onClick={(e) => onToggleMenu(e.currentTarget)}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-raised px-2.5 text-[13px] font-medium transition-colors ${
            menuOpen ? "border-accent-bright" : "border-line hover:border-accent-bright/60"
          } ${FOCUS}`}
        >
          {LABEL[role]}
          <ChevronIcon up={menuOpen} />
        </button>
      ) : (
        <span className="shrink-0 text-[13px] text-muted">{LABEL[role]}</span>
      )}
    </li>
  );
}

// ── The role menu ────────────────────────────────────────────────────────────
// Opens below the row's role button (above it if there's no room), right-
// aligned to it. Placed against the screen so the scrolling list can't clip it.

function RoleMenu({
  anchor,
  current,
  leaving,
  onClose,
  onPick,
}: {
  anchor: HTMLElement;
  current: Exclude<Role, "owner">;
  leaving: boolean;
  onClose: () => void;
  onPick: (role: Role) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  // Place it, then focus the current role.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    const below = r.bottom + 6 + el.offsetHeight <= window.innerHeight - 8;
    el.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    el.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - 6 - el.offsetHeight)}px`;
    el.style.transformOrigin = below ? "top right" : "bottom right";
    el.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [anchor]);

  // Arrow keys move between items, Home/End jump, Esc closes (only the menu).
  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't close the whole Team popup
      onClose();
    } else if (e.key === "Tab") onClose();
  }

  const item = `flex w-full items-start gap-2 rounded-lg p-2.5 text-left transition-colors hover:bg-raised focus-visible:bg-raised ${FOCUS}`;
  return (
    <div
      ref={box}
      role="menu"
      aria-label="Change role"
      onKeyDown={onKeyDown}
      className={`fixed z-[1100] w-[264px] rounded-[10px] border border-line bg-surface p-1.5 shadow-[0_20px_52px_rgba(0,0,0,0.6)] ${leaving ? "team-out" : "team-in"}`}
    >
      {CHOICES.map(({ role, hint }) => {
        const checked = role === current;
        return (
          <button
            key={role}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            tabIndex={-1}
            onClick={() => (checked ? onClose() : onPick(role))}
            className={`${item} ${checked ? "bg-raised" : ""}`}
          >
            <span className="mt-0.5 flex w-4 shrink-0 justify-center text-wine-light">{checked && <CheckIcon />}</span>
            <span>
              <span className="block text-sm font-medium text-ink">{LABEL[role]}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </button>
        );
      })}
      <div role="separator" className="my-1.5 h-px bg-line" />
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => onPick("owner")} className={item}>
        <span className="mt-0.5 flex w-4 shrink-0 justify-center text-muted">
          <LockIcon />
        </span>
        <span className="text-sm font-medium text-ink">Make owner…</span>
      </button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Open / close with an exit animation: stays on screen while `leaving`.
function useClosable() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(() => {
    clearTimeout(timer.current);
    setLeaving(false);
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setLeaving(true);
    timer.current = setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, EXIT_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { open, leaving, show, hide };
}

// Copy this board's link. Falls back to a prompt if the clipboard is blocked.
async function copyLink() {
  const link = window.location.href;
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    window.prompt("Copy this link:", link);
    return false;
  }
}

// "2 hours ago", "yesterday", "just now".
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];
function timeAgo(iso: string) {
  let v = (new Date(iso).getTime() - Date.now()) / 1000;
  if (!Number.isFinite(v)) return "a while ago";
  for (const [unit, size] of STEPS) {
    if (Math.abs(v) < size) return unit === "second" ? "just now" : RELATIVE.format(Math.round(v), unit);
    v /= size;
  }
  return "a while ago";
}

// ── Icons (inline strokes, follow the text colour) ──────────────────────────

function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M21 21v-1a6 6 0 0 0-4-5.6" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ up }: { up?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={`transition-transform ${up ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
