// ─────────────────────────────────────────────────────────────────────────────
// CTA LINK (landing page, /): the ONE primary action, with ONE label
// everywhere: "Start your first board" → /signup (DESIGN_RECORD.md).
// Wine = people, so the button is wine. Never orange (orange is the AI's).
//
// Skill rules: 8px × 12px padding, hover shifts the color, press squeezes to
// 98%, focus ring always visible.
// `quiet`: outlined instead of filled. The nav uses it while the hero's
// button is on screen, so only one wine button shows at a time.
// Loading state: while the sign-up page loads, a thin bar runs along the
// bottom of the button (no spinner) and the arrow fades out.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link, { useLinkStatus } from "next/link";
import { EASE } from "./motion";

export const CTA_LABEL = "Start your first board";

export function CtaLink({ small = false, quiet = false }: { small?: boolean; quiet?: boolean }) {
  return (
    <Link
      href="/signup"
      className={`group relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border px-3 py-2 text-ink transition-[background-color,border-color,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose active:scale-[0.98] ${
        quiet ? "border-edge bg-transparent hover:border-soft/50" : "border-accent bg-accent hover:border-[#7d2639] hover:bg-[#7d2639]"
      } ${small ? "button-sm" : "button-md"}`}
    >
      {CTA_LABEL}
      <Status />
    </Link>
  );
}

function Status() {
  const { pending } = useLinkStatus();
  return (
    <>
      <ArrowRight
        size={16}
        aria-hidden
        className={`transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 ${pending ? "opacity-0" : "opacity-100"}`}
      />
      {pending && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ink/80"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      )}
    </>
  );
}
