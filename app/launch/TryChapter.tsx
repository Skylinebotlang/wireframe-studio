// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER: TRY IT LIVE + BRING YOUR OWN AI
//
//   • The clickable demo (public/demo/index.html, the same one-file demo as
//     before). It only loads when you press "Open the live demo", so it never
//     slows down the first seconds of the page. Its agent is scripted, and
//     we say so: it works without a key or an account.
//     While the mouse is over the demo, scrolling still scrolls the page
//     (the demo passes the wheel up to us).
//   • Bring your own AI: the free built-in AI, or your own key for Gemini,
//     Claude or OpenAI (names come from lib/ai-providers.ts).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import type Lenis from "lenis";
import { PROVIDER_IDS, PROVIDERS } from "@/lib/ai-providers";

export function TryChapter() {
  const [open, setOpen] = useState(false);

  // Wheel over the demo → scroll the page.
  useEffect(() => {
    if (!open) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const dy = (e.data as { wfsWheel?: number } | null)?.wfsWheel;
      if (typeof dy !== "number") return;
      const lenis = (window as Window & { __lenis?: Lenis }).__lenis;
      if (lenis) lenis.scrollTo(lenis.scroll + dy, { immediate: false });
      else window.scrollBy(0, dy);
    };
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, [open]);

  return (
    <section id="try" className="ls-chapter ls-try" aria-labelledby="ls-try-title">
      <div className="ls-try-head">
        <h2 id="ls-try-title" className="ls-h2">
          Try it here. No sign-up.
        </h2>
        <p className="ls-body">
          Drop a note, ask the agent, watch it draw. The agent in this demo is scripted, so it runs in your browser
          without a key.
        </p>
      </div>

      <div className="ls-demo">
        {open ? (
          <iframe src="/demo/index.html" title="Wireframe Studio demo" className="ls-demo-frame" />
        ) : (
          <button type="button" className="ls-demo-poster dots" onClick={() => setOpen(true)}>
            <span className="ls-demo-poster-frame" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="ls-btn ls-btn--ghost">Open the live demo</span>
          </button>
        )}
      </div>

      <div className="ls-byo">
        <div>
          <h3 className="ls-h3">Bring your own AI</h3>
          <p className="ls-body">
            Start with the free built-in AI. Or plug in your own key. Your key stays in your browser.
          </p>
        </div>
        <ul className="ls-providers">
          <li>
            <span className="ls-prov-name">Free built-in AI</span>
            <span className="ls-mono ls-prov-k">No key needed</span>
          </li>
          {PROVIDER_IDS.map((id) => (
            <li key={id}>
              <span className="ls-prov-name">{PROVIDERS[id].label}</span>
              <span className="ls-mono ls-prov-k">Your {PROVIDERS[id].company} key</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
