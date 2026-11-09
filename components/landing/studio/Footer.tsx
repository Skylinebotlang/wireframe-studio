// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA + FOOTER (landing page, /): the same button as the hero,
// then a plain row: a line with some personality, links, the copyright.
// Still missing (needs papi's real text first): privacy policy and terms.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowUp } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { CtaLink } from "./CtaLink";
import { Reveal } from "./motion";

const LINK = "inline-flex items-center gap-2 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-6 pt-20 md:px-12 md:pt-24">
      <Reveal className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-accent/70 bg-panel p-8 md:flex-row md:items-center md:p-12">
        <h2 className="heading-4 md:heading-3 max-w-[680px] text-balance">Bring your team’s notes. Leave with screens.</h2>
        <CtaLink />
      </Reveal>

      <div className="caption-2 flex flex-col gap-4 py-12 text-faint md:flex-row md:items-center md:justify-between">
        <p>Made for teams who argue about checkouts.</p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/login" className={LINK}>
            Sign in
          </Link>
          <Link href="/boards" className={LINK}>
            Your boards
          </Link>
          <a href="#main" className={LINK}>
            Back to top <ArrowUp size={16} aria-hidden />
          </a>
        </nav>
        <p>© 2026 Wireframe Studio</p>
      </div>
    </footer>
  );
}
