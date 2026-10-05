// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/".
//
//   • Left:  what Wireframe Studio is, and a "Get started" button that goes
//            to the sign-in page (app/login/page.tsx).
//   • Right: a small picture of the idea (people's notes → agent → wireframe).
//   • Below: three "how it works" steps.
//
// Colors follow the house rule: wine = people, ORANGE = the agent only.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { Splash } from "./Splash";

export default function LandingPage() {
  return (
    <main className="dot-grid min-h-screen select-none">
      {/* Covers the page until the visitor clicks or drags (app/Splash.tsx). */}
      <Splash />
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-heading text-lg font-semibold tracking-tight text-ink">
          <Image src="/logo-2d.png" alt="" draggable={false} width={28} height={28} className="mr-2 inline-block align-middle" />
          Wireframe<span className="text-accent-bright">·</span>Studio
        </span>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:text-ink"
        >
          Sign in →
        </Link>
      </header>

      {/* ── Hero: pitch on the left, picture of the idea on the right ───── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_auto] lg:pt-16">
        <div className="pop-in">
          <h1 className="neon-text font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Your whole team.
            <br />
            One canvas.
            <br />
            <span className="text-muted">An AI teammate.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted">
            Drop notes together. The agent turns them into wireframes, live.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-block rounded-md bg-accent px-6 py-3 font-medium text-ink shadow-[0_0_18px_-4px_var(--accent-bright)] transition hover:brightness-125"
          >
            Get started →
          </Link>
        </div>

        <IdeaPicture />
      </section>

      {/* ── How it works: three short steps ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="glass tilt flex items-baseline gap-3 rounded-xl p-5">
              <span className={`font-mono text-xs ${step.agent ? "text-agent" : "text-accent-bright"}`}>
                0{i + 1}
              </span>
              <h3 className="font-heading text-lg text-ink">{step.title}</h3>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

// The three steps. `agent: true` marks the step the AI does (orange number).
const STEPS = [
  { title: "Drop notes", agent: false },
  { title: "Agent merges", agent: true },
  { title: "Wireframes appear", agent: false },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// A small, static picture of the product idea, built from plain boxes:
// two people's notes → the agent (orange) → a grey-box wireframe.
// Hidden on small phones, where the text alone is enough.
// ─────────────────────────────────────────────────────────────────────────────
function IdeaPicture() {
  return (
    <div aria-hidden className="glass pop-in hidden items-center gap-4 rounded-xl p-6 sm:flex">
      {/* People's notes (wine headers) */}
      <div className="flex flex-col gap-2">
        <MiniNote who="Priya · PM" text="Summary at the top" />
        <MiniNote who="Leo · Designer" text="Keep it minimal" />
      </div>

      <Arrow />

      {/* The agent — orange is reserved for it */}
      <div className="rounded-full border border-agent/50 bg-paper/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-agent shadow-[0_0_20px_-6px_var(--agent)]">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-agent align-middle" />
        Agent
      </div>

      <Arrow />

      {/* The wireframe it draws (grey boxes in a phone frame) */}
      <div className="w-24 rounded-lg border border-line bg-surface p-2">
        <div className="h-2 rounded-sm bg-muted/40" />
        <div className="mt-1.5 h-6 rounded-sm border border-dashed border-muted/50" />
        <div className="mt-1.5 h-1.5 w-3/4 rounded-sm bg-muted/25" />
        <div className="mt-1 h-1.5 w-1/2 rounded-sm bg-muted/25" />
        <div className="mt-2 h-3 rounded-sm bg-muted/40" />
      </div>
    </div>
  );
}

function MiniNote({ who, text }: { who: string; text: string }) {
  return (
    <div className="w-36 overflow-hidden rounded-md border border-line bg-surface">
      <div className="bg-accent px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-ink">{who}</div>
      <div className="px-2 py-1.5 text-[11px] text-ink">{text}</div>
    </div>
  );
}

function Arrow() {
  return <span className="font-mono text-muted">→</span>;
}
