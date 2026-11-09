// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MOCK (landing page, /): the hero's centrepiece. A coded
// re-creation of a real board, playing one agent run when it scrolls into view:
//
//   0 notes      three teammates' prompt notes are on the canvas
//   1 reading    agent panel: a skeleton of the answer while it reads (loading)
//   2 clash      agent panel: the clash it found and how it settled it
//   3 drawing    two phone screens appear as skeletons (loading)
//   4 done       the screens fill in, "2 screens drawn", and "Run again"
//
// Useful feedback: hover or focus a note and the parts of the screens that
// note changed light up in wine.
// "Reduce motion" on: it shows the finished board straight away.
//
// Layout follows the corner rule: outer card 24 with 8 padding holds blocks
// of 16 (app bar, canvas, agent panel). Colors: the page's blacks + wine
// (the real app marks the AI in orange; this page has no orange on purpose).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DotGrid } from "./DotGrid";
import { EASE } from "./motion";

type Role = "pm" | "design" | "dev";

const NOTES: { role: Role; who: string; text: string; dot: string }[] = [
  { role: "pm", who: "PM", text: "Checkout in one step, no extra screens.", dot: "bg-ink" },
  { role: "design", who: "Designer", text: "A big product photo on the first screen.", dot: "bg-rose" },
  { role: "dev", who: "Developer", text: "Reuse the cart API. Three steps is simpler.", dot: "bg-faint" },
];

// When each phase starts, in ms after the run begins.
const TIMELINE = [900, 2700, 4600, 6600];

export function ProductMock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0); // bump to replay
  const [hot, setHot] = useState<Role | null>(null);
  const phase = reduced ? 4 : step; // "reduce motion": always the finished board

  useEffect(() => {
    if (reduced || !inView) return;
    const timers = TIMELINE.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced, run]);

  const replay = () => {
    setStep(0);
    setRun((r) => r + 1);
  };

  const lit = (role: Role) =>
    `outline-offset-2 transition-[outline-color] duration-300 ${hot === role ? "outline-2 outline-rose" : "outline-2 outline-transparent"}`;

  return (
    <div
      ref={ref}
      className="flex flex-col gap-2 rounded-3xl border border-edge bg-panel p-2 text-left"
    >
      {/* App bar */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-panel-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/logo-2d.png" alt="" width={18} height={18} />
          <span className="title-4 truncate">Checkout redesign</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden>
            {NOTES.map((n) => (
              <span key={n.role} className={`h-6 w-6 rounded-full border-2 border-panel-2 ${n.dot}`} />
            ))}
          </div>
          <span className="button-sm rounded-lg bg-accent px-3 py-1">Share</span>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_300px]">
        {/* Canvas */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-void p-4 md:min-h-[440px] md:flex-row md:items-center md:gap-8 md:p-10">
          <DotGrid />
          <ul className="relative flex flex-col gap-2 md:w-60 md:shrink-0 md:gap-3" aria-label="Prompt notes on the board">
            {NOTES.map((n, i) => (
              <motion.li
                key={n.role}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, ease: EASE, delay: 0.15 * i }}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHot(n.role)}
                  onMouseLeave={() => setHot(null)}
                  onFocus={() => setHot(n.role)}
                  onBlur={() => setHot(null)}
                  aria-label={`${n.who}'s note: ${n.text} Highlights what it changed.`}
                  className={`block w-full overflow-hidden rounded-xl border text-left transition-[border-color,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none ${
                    hot === n.role ? "-translate-y-0.5 border-rose" : "border-edge"
                  }`}
                >
                  <span className="title-4 flex items-center gap-2 bg-accent px-3 py-2">
                    <span className={`h-2 w-2 rounded-full ${n.dot}`} />
                    {n.who}
                  </span>
                  <span className="body-6 block bg-panel-2 px-3 py-2 text-pretty text-soft">{n.text}</span>
                </button>
              </motion.li>
            ))}
          </ul>

          {/* Wireframes the agent draws: skeletons while drawing, then filled */}
          <div className="relative flex flex-1 items-center justify-center gap-4 md:gap-6" aria-hidden>
            {[0, 1].map((screen) => (
              <motion.div
                key={`${run}-${screen}`}
                initial={false}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.6, ease: EASE, delay: reduced ? 0 : screen * 0.3 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex h-56 w-28 flex-col gap-2 rounded-2xl border border-soft/30 bg-panel p-2 md:h-80 md:w-40">
                  {phase < 4 ? (
                    <PhoneSkeleton photo={screen === 0} />
                  ) : screen === 0 ? (
                    <>
                      <span className={`caption-4 rounded-lg bg-panel-3 text-center text-faint ${lit("pm")}`}>Step 1 of 2</span>
                      <span className={`h-16 rounded-lg bg-panel-3 md:h-28 ${lit("design")}`} />
                      <span className={`flex flex-col gap-2 rounded-lg p-1 ${lit("dev")}`}>
                        <span className="h-2 w-4/5 rounded-full bg-panel-3" />
                        <span className="h-2 w-3/5 rounded-full bg-panel-3" />
                        <span className="h-2 w-2/3 rounded-full bg-panel-3" />
                      </span>
                      <span className="mt-auto h-8 rounded-lg bg-accent" />
                    </>
                  ) : (
                    <>
                      <span className={`caption-4 rounded-lg bg-panel-3 text-center text-faint ${lit("pm")}`}>Step 2 of 2</span>
                      <span className="h-8 rounded-lg border border-edge" />
                      <span className="h-8 rounded-lg border border-edge" />
                      <span className={`h-8 rounded-lg border border-edge ${lit("dev")}`} />
                      <span className={`mt-auto h-8 rounded-lg bg-accent ${lit("pm")}`} />
                    </>
                  )}
                </div>
                <span className="caption-2 text-faint">{screen === 0 ? "Cart and address" : "Payment"}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Agent panel */}
        <aside className="flex min-h-48 flex-col gap-3 rounded-2xl bg-panel-2 p-4 md:min-h-[280px]">
          <p className="title-4">Agent</p>
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 0 && (
              <Panel key="idle">
                <p className="body-6 text-faint">3 notes on the board. Waiting for a run.</p>
              </Panel>
            )}
            {phase === 1 && (
              <Panel key="reading">
                <p className="body-6 text-ink" role="status">
                  Reading 3 notes
                </p>
                {/* Skeleton shaped like the answer card that's coming */}
                <Pulse className="mt-3 flex flex-col gap-2 rounded-lg bg-panel-3 p-3">
                  <span className="h-2 w-1/2 rounded-full bg-edge" />
                  <span className="h-2 w-4/5 rounded-full bg-edge" />
                  <span className="mt-2 h-2 w-3/4 rounded-full bg-edge" />
                  <span className="h-2 w-2/3 rounded-full bg-edge" />
                </Pulse>
              </Panel>
            )}
            {phase >= 2 && (
              <Panel key="clash">
                <div className="body-6 rounded-lg bg-panel-3 p-3">
                  <p className="text-faint">1 clash: checkout steps</p>
                  <p className="mt-1 text-pretty text-soft">PM wants 1 step. Developer wants 3.</p>
                  <p className="mt-2 text-pretty text-ink">
                    <span className="text-rose">Decision:</span> 2 steps. Guest checkout stays, the photo leads step 1.
                  </p>
                </div>
              </Panel>
            )}
            {phase === 3 && (
              <Panel key="drawing">
                <p className="body-6 text-ink" role="status">
                  Drawing 2 screens
                </p>
              </Panel>
            )}
            {phase === 4 && (
              <Panel key="done">
                <p className="body-6 flex items-center gap-2 text-ink" role="status">
                  <Check size={16} className="text-rose" aria-hidden />2 screens drawn
                </p>
                <button
                  type="button"
                  onClick={replay}
                  className="button-sm mt-3 inline-flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-soft transition-[color,border-color,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-soft/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-rose active:scale-[0.98]"
                >
                  <ArrowCounterClockwise size={16} aria-hidden />
                  Run again
                </button>
              </Panel>
            )}
          </AnimatePresence>
          {phase === 4 && (
            <p className="caption-2 mt-auto text-faint">
              {/* Touch screens have no hover: tapping a note focuses it, which lights it up too */}
              <span className="[@media(hover:hover)]:hidden">Tap</span>
              <span className="hidden [@media(hover:hover)]:inline">Hover</span> a note to see what it changed.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      // The old line fades out first, then the new one comes in, so they never overlap.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE } }}
    >
      {children}
    </motion.div>
  );
}

/** A loading skeleton that gently breathes (opacity only). */
function Pulse({ className, children }: { className: string; children?: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, ease: EASE, repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

function PhoneSkeleton({ photo }: { photo: boolean }) {
  return (
    <Pulse className="flex h-full flex-col gap-2">
      <span className="h-4 rounded-lg bg-panel-3" />
      {photo && <span className="h-16 rounded-lg bg-panel-3 md:h-28" />}
      <span className="h-2 w-4/5 rounded-full bg-panel-3" />
      <span className="h-2 w-3/5 rounded-full bg-panel-3" />
      <span className="mt-auto h-8 rounded-lg bg-panel-3" />
    </Pulse>
  );
}
