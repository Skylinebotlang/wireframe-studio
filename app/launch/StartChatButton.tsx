// ─────────────────────────────────────────────────────────────────────────────
// "START THE CHAT" — the one button the whole site leads to. It appears in
// the top bar, the hero, after "How it works", and at the very end.
//
// Pressing it opens a small choice:
//   • I have an account → Sign in (the existing /login page)
//   • I'm new here      → Sign up (the existing /signup page)
//
// Uses the browser's own <dialog>: Escape closes it, focus stays inside,
// screen readers announce it. A click on the dark backdrop closes it too.
// Wine = people. No orange here: this is a person's action.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useId, useRef } from "react";

export function StartChatButton({ size = "lg", className = "" }: { size?: "lg" | "sm"; className?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className={`ls-btn ${size === "sm" ? "ls-btn--sm" : ""} ${className}`}
        onClick={() => dlg.current?.showModal()}
        aria-haspopup="dialog"
      >
        Start the chat
      </button>

      <dialog
        ref={dlg}
        className="ls-dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      >
        <div className="ls-dialog-card">
          <div className="ls-dialog-top">
            <h2 id={titleId} className="ls-dialog-title">
              Join your team’s canvas
            </h2>
            <button type="button" className="ls-dialog-close" onClick={() => dlg.current?.close()} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="ls-dialog-opts">
            <Link href="/login" className="ls-opt">
              <span className="ls-mono ls-opt-k">I have an account</span>
              <span className="ls-opt-t">Sign in</span>
            </Link>
            <Link href="/signup" className="ls-opt ls-opt--new">
              <span className="ls-mono ls-opt-k">I’m new here</span>
              <span className="ls-opt-t">Sign up</span>
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
