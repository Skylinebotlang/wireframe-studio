// ─────────────────────────────────────────────────────────────────────────────
// MOTION HELPERS (landing page, /)
//
// Rules (landing-page-design skill, B7): one curve for everything,
// cubic-bezier(0.22, 1, 0.36, 1); only transform and opacity move.
//   <Reveal>   a section rises 32px and fades in the first time it scrolls
//              into view (Framer Motion's whileInView, once only)
//   <Stagger>  + <Item>: the hero comes in line by line on load
// <MotionRoot> wraps the page. With reducedMotion="user", people who turned on
// "reduce motion" get plain fades with no movement.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Rises 32px and fades in the first time it scrolls into view. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const parent: Variants = { show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } };
const child: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/** Plays its <Item> children one after another when the page loads. */
export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={parent} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function Item({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={child}>
      {children}
    </motion.div>
  );
}
