"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR — the slim navigation bar on every signed-in page (/boards, rooms).
//
//   left:   logo (→ My boards), then whatever the page adds (`children`):
//           inside a board that's the board name, Decisions and Share
//   right:  "Your AI key" button, then your initial in your cursor color,
//           which opens a menu: your profile, My boards, Sign out
//
// Wine marks people and the active page; orange stays reserved for the AI.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AiKeyButton } from "./AiKeyButton";
import { supabase, useAccount } from "@/lib/auth";
import { loadIdentity, type UserIdentity } from "@/lib/user";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      // relative + z-index: menus that drop down from the bar sit above the canvas.
      className="relative z-[700] flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 text-sm text-ink"
    >
      <Link href="/boards" className="flex shrink-0 items-center gap-2 font-heading tracking-tight" title="My boards">
        <Image src="/logo-2d.png" alt="" width={22} height={22} />
        <span className="hidden sm:inline">
          Wireframe<span className="text-accent-bright">·</span>Studio
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      <AiKeyButton />
      <ProfileMenu />
    </nav>
  );
}

/** A quiet bar button: icon + label (label hidden on phones). */
export function BarButton({
  icon,
  label,
  onClick,
  active,
  strong,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  strong?: boolean; // the one filled button (Share)
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors ${
        strong
          ? "bg-accent text-ink hover:brightness-125"
          : active
            ? "bg-raised text-ink"
            : "text-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function ProfileMenu() {
  const account = useAccount();
  const router = useRouter();
  const [me, setMe] = useState<UserIdentity | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMe(loadIdentity()));
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on Escape or a click outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const name = me?.name || account?.name || "?";
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your account"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium uppercase text-paper ring-offset-2 ring-offset-surface transition hover:ring-2 hover:ring-line"
        style={{ backgroundColor: me?.color ?? "#e0607e" }}
      >
        {name.trim().charAt(0)}
      </button>
      {open && (
        <div
          role="menu"
          className="glass pop-in absolute right-0 top-10 z-[1000] w-56 rounded-xl p-1.5 text-sm"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{account?.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuLink href="/login" label="Your profile" hint="Name, role, cursor color" />
          <MenuLink href="/boards" label="My boards" />
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.replace("/login"))}
            className="w-full rounded-md px-2.5 py-2 text-left text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link role="menuitem" href={href} className="block rounded-md px-2.5 py-2 transition-colors hover:bg-raised">
      <span className="text-ink">{label}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </Link>
  );
}
