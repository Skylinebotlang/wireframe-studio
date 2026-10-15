// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR — logo + name on the left; on the right, the AI's status (the 3D
// character shrinks into the round spot here after the hero), Sign in, and
// a small "Start the chat".
//
// The status line changes with the chapter you're reading, like the agent
// status in the app: "drawing", "listening", "waiting for you"...
// It stays hidden until the loader has handed off (the loader fades it in).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { StartChatButton } from "./StartChatButton";

export const STATUS_EVENT = "ls:status";

export function LaunchNav() {
  const [status, setStatus] = useState("getting ready");

  // Layout effect: listens before the hero (later in the page) sends its first status.
  useLayoutEffect(() => {
    const on = (e: Event) => setStatus((e as CustomEvent<string>).detail);
    addEventListener(STATUS_EVENT, on);
    return () => removeEventListener(STATUS_EVENT, on);
  }, []);

  return (
    <header className="ls-nav">
      <Link href="/" className="ls-brand" aria-label="Wireframe Studio, back to top">
        <Image src="/logo-2d.png" alt="" width={28} height={28} priority />
        <span>Wireframe Studio</span>
      </Link>
      <div className="ls-nav-right">
        <div className="ls-status" aria-hidden>
          <span id="ls-spot-nav" className="ls-status-spot" />
          <span className="ls-mono ls-status-text">
            Agent <span className="ls-status-state">{status}</span>
          </span>
        </div>
        <Link href="/login" className="ls-navlink">
          Sign in
        </Link>
        <StartChatButton size="sm" />
      </div>
    </header>
  );
}

export function setAgentStatus(s: string) {
  dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: s }));
}
