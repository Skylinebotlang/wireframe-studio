// ─────────────────────────────────────────────────────────────────────────────
// FAQ (landing page, /): heading on the left, eight questions on the
// right, each its own rounded card.
// Click a question: the answer fades in and the + turns into an × (transform
// and opacity only, per the motion rules). Each question is a button that
// tells screen readers whether it's open. Answers must stay true to the app:
// no free AI; key saved in the browser only; roles from lib/roles.ts;
// providers from lib/ai-providers.ts; the board is laptop/desktop only.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { Plus } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";
import { EASE, Reveal } from "./motion";

const FAQS = [
  {
    q: "Do I need my own AI key?",
    a: "Yes. Wireframe Studio has no built in AI. Paste a key from one of the supported services and the agent runs on it.",
  },
  {
    q: "Which AI services work?",
    a: "17 of them, including Gemini, Claude, OpenAI, Groq, OpenRouter, DeepSeek, Kimi and Mistral. Most keys are recognised the moment you paste them; for the rest, you pick the service from a list.",
  },
  {
    q: "Where does my key go?",
    a: "It’s saved in your own browser only. When you run the agent, it goes to our server for that one request and is then forgotten. Your teammates never see it.",
  },
  {
    q: "What does it cost?",
    a: "Nothing while we’re in beta, and sign up asks for no card. You pay your AI provider directly for what the agent uses.",
  },
  {
    q: "What happens when two notes disagree?",
    a: "The agent picks a way to merge them and writes down why in the decision log. Anyone who can edit the board can overrule it and choose one person’s version instead.",
  },
  {
    q: "Who can join my board?",
    a: "Anyone you share the link with. New people join as viewers, and you decide who can draw, add notes or run the AI.",
  },
  {
    q: "What does it actually draw?",
    a: "Phone sized grey box wireframes, right on the canvas. When you like one, Make it real turns it into a finished design.",
  },
  {
    q: "Can I use it on my phone?",
    a: "This page, yes. The board itself is built for laptops and desktops for now.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <section id="faq" className="mx-auto grid w-full max-w-[1200px] scroll-mt-24 gap-8 px-6 py-20 md:grid-cols-12 md:px-12 md:py-24">
      <Reveal className="md:sticky md:top-24 md:col-span-4 md:self-start">
        <h2 className="heading-4 md:heading-2 text-balance">Before you start a board</h2>
      </Reveal>
      <Reveal className="md:col-span-7 md:col-start-6" delay={0.1}>
        <ul className="flex flex-col gap-2">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q} className="rounded-2xl border border-edge bg-panel">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${id}-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="title-2 flex w-full items-center justify-between gap-6 rounded-2xl px-6 py-4 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-rose focus-visible:outline-2 focus-visible:outline-rose"
                  >
                    {f.q}
                    <Plus
                      size={20}
                      aria-hidden
                      className={`shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? "rotate-45 text-rose" : ""}`}
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.p
                      id={`${id}-${i}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="body-3 max-w-[36rem] text-pretty px-6 pb-6 text-soft"
                    >
                      {f.a}
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}
