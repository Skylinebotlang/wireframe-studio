// ─────────────────────────────────────────────────────────────────────────────
// TRY IT (landing page, /): the same checkout clash from the story,
// now for the visitor to settle. Pick the agent's merge or one person's
// version and the decision and the screens below it update, like the real
// decision log. One heading only (the card's), so nothing competes with it.
//
// Corner rule: card 24 with 8 padding holds a 16 well; the picker (12) with
// 4 padding holds 8 buttons.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { EASE, Reveal } from "./motion";

const OPTIONS = [
  { id: "merge", label: "Agent’s merge", steps: 2, by: "the agent", text: "2 steps. Guest checkout stays, the photo leads step 1." },
  { id: "pm", label: "PM’s version", steps: 1, by: "you", text: "1 step. Everything on one long screen." },
  { id: "dev", label: "Developer’s version", steps: 3, by: "you", text: "3 steps: cart, address, then payment." },
];

export function TryIt() {
  const [pick, setPick] = useState(OPTIONS[0]);

  return (
    <section id="try" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-6 py-20 md:px-12 md:py-24">
      <Reveal>
        <article className="grid gap-2 rounded-3xl border border-accent/70 bg-panel p-2 md:grid-cols-2">
          <div className="flex flex-col justify-center px-4 py-6 md:px-10 md:py-12">
            <h2 className="heading-4 md:heading-2 text-balance">Now you settle it</h2>
            <p className="body-3 md:body-7 mt-4 max-w-[30rem] text-pretty text-soft">
              The agent made its call and wrote down why. Anyone who can edit the board can overrule it in one click.
              Pick a version and watch the screens change.
            </p>
          </div>

          <div className="rounded-2xl bg-void p-6 md:p-8">
            <p className="caption-2 text-faint">Clash: checkout steps</p>
            <p className="title-2 mt-1">PM wants 1 step. Developer wants 3.</p>

            <LayoutGroup>
              <div
                role="radiogroup"
                aria-label="Which version to keep"
                className="mt-6 grid grid-cols-1 gap-1 rounded-xl bg-panel-3 p-1 sm:grid-cols-3"
              >
                {OPTIONS.map((o) => {
                  const on = o.id === pick.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPick(o)}
                      className={`button-sm relative whitespace-nowrap rounded-lg px-3 py-2 transition-[color,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-rose active:scale-[0.98] ${
                        on ? "text-ink" : "text-soft hover:text-ink"
                      }`}
                    >
                      {on && (
                        <motion.span
                          layoutId="clash-pick"
                          className="absolute inset-0 rounded-lg bg-accent"
                          transition={{ duration: 0.5, ease: EASE }}
                        />
                      )}
                      <span className="relative">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            <div className="mt-6 min-h-20" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pick.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <p className="body-3 text-pretty">
                    <span className="text-rose">Decision:</span> {pick.text}
                  </p>
                  <p className="caption-2 mt-1 text-faint">Picked by {pick.by}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* The screens redraw to match the pick */}
            <div className="mt-6 flex h-44 items-end gap-3" aria-hidden>
              <AnimatePresence initial={false}>
                {Array.from({ length: pick.steps }, (_, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="flex h-44 w-24 flex-col gap-2 rounded-xl border border-soft/30 bg-panel p-2"
                  >
                    {i === 0 && <span className="h-14 rounded-sm bg-panel-3" />}
                    <span className="h-2 w-4/5 rounded-full bg-panel-3" />
                    <span className="h-2 w-3/5 rounded-full bg-panel-3" />
                    <span className="mt-auto h-4 rounded-sm bg-accent" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </article>
      </Reveal>
    </section>
  );
}
