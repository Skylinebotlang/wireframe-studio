// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR (landing page, /)
//
// A compact bar that floats just below the top edge, centered and only as
// wide as its contents: see-through dark surface with a blur behind it.
// The link for the section you're reading is highlighted (it watches the
// sections with IntersectionObserver, no scroll listener).
//
// Phones: logo + a menu button whose two lines turn into an ×. The menu opens
// as a full-height panel; its links rise in one after another.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CtaLink } from "./CtaLink";
import { EASE } from "./motion";

const LINKS = [
  { id: "story", label: "The story" },
  { id: "board", label: "The board" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

const T = "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

export function Nav() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);

  // While the hero's button is on screen, the nav button stays outlined, so
  // only one wine button shows at a time.
  useEffect(() => {
    const el = document.getElementById("hero-cta");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroCtaVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Highlight the section in the middle of the screen (none between sections).
  useEffect(() => {
    const inMiddle = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? inMiddle.add(e.target.id) : inMiddle.delete(e.target.id)));
        setActive(LINKS.find((l) => inMiddle.has(l.id))?.id ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Phone menu: Escape closes it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-2xl border border-edge bg-panel/70 p-2 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1" aria-label="Wireframe Studio, back to top">
          <Image src="/logo-2d.png" alt="" width={20} height={20} priority />
          <span className="title-3 whitespace-nowrap">Wireframe Studio</span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center md:flex">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? "true" : undefined}
              className={`title-4 rounded-lg px-3 py-2 ${T} ${
                active === l.id ? "bg-panel-3 text-ink" : "text-soft hover:text-ink"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <Link href="/login" className={`title-4 hidden rounded-lg px-3 py-2 text-soft hover:text-ink md:block ${T}`}>
          Sign in
        </Link>
        <span className="hidden md:block">
          <CtaLink small quiet={heroCtaVisible} />
        </span>

        {/* Phone menu button: the two lines rotate into an × */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="phone-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
          className="relative h-10 w-10 rounded-lg focus-visible:outline-2 focus-visible:outline-rose md:hidden"
        >
          {[-1, 1].map((dir) => (
            <span
              key={dir}
              aria-hidden
              className="absolute left-3 top-1/2 h-0.5 w-4 rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: open ? `rotate(${dir * 45}deg)` : `translateY(${dir * 4}px)` }}
            />
          ))}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="phone-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 -z-10 flex flex-col bg-void/95 px-6 pb-12 pt-24 backdrop-blur-xl md:hidden"
          >
            <nav aria-label="Menu" className="flex flex-col gap-2">
              {[...LINKS.map((l) => ({ href: `#${l.id}`, label: l.label })), { href: "/login", label: "Sign in" }].map(
                (l, i) => (
                  <motion.a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    // 60ms apart, whole sequence capped at 400ms
                    transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.06, 0.4) }}
                    className="heading-4 py-3 text-ink"
                  >
                    {l.label}
                  </motion.a>
                ),
              )}
            </nav>
            <div className="mt-auto">
              <CtaLink />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
