// ─────────────────────────────────────────────────────────────────────────────
// THE STORY (landing page, /): the top of the page, told around one
// round table (the 3D scene in table3d.ts).
//
// The 3D stage stays pinned to the screen while six chapters of text scroll
// over it. How far you've scrolled through the section (0 → 1) becomes the
// scene's chapter number (0 → 5), via Framer Motion's useScroll, which batches
// scroll reads per frame (no raw scroll listener).
//
//   0 hero · 1 the mess · 2 one table · 3 the clash · 4 the screens ·
//   5 everyone has the context (the tagline, revealed word by word)
//
// Desktop: text on the left, the table on the right. Phones: the table up top,
// text in a dark panel at the bottom. The 3D code loads after the page has
// painted; with no WebGL the text still tells the whole story on black.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useEffect, useRef } from "react";
import { CtaLink } from "./CtaLink";
import { Item, Reveal, Stagger } from "./motion";
import type { TableHandle } from "./table3d";
import { Tagline } from "./Tagline";

const CHAPTERS = [
  {
    title: "Three people. Three chats. Three different checkouts.",
    body: "Everyone asked their own AI. Now someone has to merge three answers by hand, and nobody remembers why.",
  },
  {
    title: "Put every note on one table.",
    body: "The PM, the designer and the developer drop their notes on one shared board. The agent reads all of them at once.",
  },
  {
    title: "The clash gets settled out loud.",
    body: "The PM wants one step. The developer wants three. The agent picks two, keeps guest checkout and writes down why. Anyone can overrule it.",
  },
  {
    title: "Then the screens appear.",
    body: "Phone sized wireframes, drawn live on the board while the whole room watches.",
  },
];

const LAST = CHAPTERS.length + 1; // hero + chapters + tagline → stops 0 … 5

// Text block: left column on desktop, dark panel at the bottom on phones.
const BOX = "w-full rounded-2xl bg-void/80 p-6 backdrop-blur-md md:bg-transparent md:p-0 md:backdrop-blur-none";

export function Story() {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TableHandle | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (p) => scene.current?.setStop(p * LAST));

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    // Canvas text uses the page's font, so wait for it before drawing cards.
    Promise.all([import("./table3d"), document.fonts.ready]).then(([{ createTable }]) => {
      if (cancelled) return;
      try {
        scene.current = createTable(el, {
          reduced: !!reduced,
          small: innerWidth < 900,
          font: getComputedStyle(el).fontFamily,
        });
        scene.current.setStop(scrollYProgress.get() * LAST);
      } catch {
        // No WebGL: the black stage stays, the text still tells the story.
      }
    });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [reduced, scrollYProgress]);

  return (
    <section id="story" ref={section} className="relative">
      <div className="sticky top-0 h-[100svh] overflow-hidden" aria-hidden>
        <div ref={host} className="absolute inset-0" />
      </div>

      <div className="relative -mt-[100svh]">
        {/* 0 — Hero */}
        <Chapter>
          <Stagger className={`${BOX} md:max-w-[600px]`}>
            <Item>
              <h1 className="heading-4 md:heading-1 hero-ink max-w-[680px] text-balance">
                Your team talks. <br />
                One plan comes out.
              </h1>
            </Item>
            <Item>
              <p className="body-3 md:body-7 mt-6 max-w-[680px] text-pretty text-soft">
                Put your PM, designer and developer at one table. An AI teammate reads every note, settles the
                clashes out loud and draws the screens for everyone.
              </p>
            </Item>
            <Item className="mt-8 flex flex-col items-start gap-4">
              <div id="hero-cta">
                <CtaLink />
              </div>
              <p className="caption-2 text-balance text-faint">Works with Gemini, Claude, OpenAI and 14 more AI services</p>
            </Item>
          </Stagger>
        </Chapter>

        {/* 1 – 4 — the story */}
        {CHAPTERS.map((c) => (
          <Chapter key={c.title}>
            <Reveal className={`${BOX} md:max-w-[440px]`}>
              <h2 className="heading-4 md:heading-3 text-balance">{c.title}</h2>
              <p className="body-3 md:body-7 mt-4 text-pretty text-soft">{c.body}</p>
            </Reveal>
          </Chapter>
        ))}

        {/* 5 — the tagline */}
        <Chapter>
          <div className={`${BOX} md:max-w-[560px]`}>
            <Tagline />
          </div>
        </Chapter>
      </div>
    </section>
  );
}

function Chapter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[1200px] items-end px-6 pb-8 pt-24 md:items-center md:px-12 md:pb-0">
      {children}
    </div>
  );
}
