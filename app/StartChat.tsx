// ─────────────────────────────────────────────────────────────────────────────
// START THE CHAT — the main button on the landing page (hero, chapter 02,
// chapter 06). Pressing it opens a small choice:
//
//   • Sign in → the existing login page (app/login/).
//   • Sign up → the registration form (app/signup/). Demo mode for now.
//
// Uses the browser's own <dialog>, so Escape closes it, focus stays inside
// it, and screen readers announce it. Click outside the card to close too.
// Colors: wine = people. No orange (this is a human action).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useRef } from "react";

export function StartChat({ className = "" }: { className?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className={`lp-btn lp-mono ${className}`} onClick={() => dlg.current?.showModal()}>
        Start the chat <span aria-hidden>→</span>
      </button>

      <dialog
        ref={dlg}
        className="sc-dialog"
        aria-labelledby="start-title"
        // A click on the dark backdrop (the dialog itself, not the card) closes it.
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      >
        <div className="sc-card">
          <div className="flex items-start justify-between">
            <span className="lp-mono text-muted">Start the chat</span>
            <button type="button" className="lp-mono sc-close" onClick={() => dlg.current?.close()} aria-label="Close">
              ✕
            </button>
          </div>
          <h2 id="start-title" className="lp-head sc-title">
            Join your team’s canvas.
          </h2>

          <div className="sc-options">
            <Link href="/login" className="sc-opt">
              <span className="lp-mono sc-opt-k">I have an account</span>
              <span className="sc-opt-t">Sign in →</span>
            </Link>
            <Link href="/signup" className="sc-opt">
              <span className="lp-mono sc-opt-k">I’m new here</span>
              <span className="sc-opt-t">Sign up →</span>
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
