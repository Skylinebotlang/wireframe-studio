// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE — the front door at "/" (the round table story).
//
// Replaced the launch site v2 homepage on 2026-11-09 (old version is in git
// history and archive/). Follows the landing-page-design skill (~/.claude/skills/landing-page-design); where it
// clashes with older project rules, the skill wins (papi's call).
//
// DESIGN SYSTEM (tokens + text styles live in app/globals.css,
// "Landing page design system"):
//   Font      Geist only, one typeface. No italics, nothing above semibold.
//   Text      Named styles only: heading-1…6, title-1…4, body-2/3/6,
//             button-md/sm, caption-1/2/4. Sizes are Tailwind scale steps.
//             Headings balanced, body text "pretty" (no lone last words).
//   Colors    Our navy palette: void #090719 (page), panel #131224,
//             panel-2 #191A2F, panel-3 #22213A. Text: ink, soft, faint (all
//             AA or better). Accent: wine (#681E2E fills, rose #E0607E for
//             icons and highlights). Orange only for the AI, in the 3D scene.
//   Hero      Heading in a soft white → muted text color; heading and subheading
//             capped at 680px. No gradients anywhere else.
//   Spacing   Only 0 2 4 8 12 16 24 32 40 48 64 80 96 px.
//   Corners   Tailwind radii; nested: inner = outer − gap (card 24 → 16 → 8).
//   Icons     Phosphor only.
//   Motion    One curve, cubic-bezier(0.22, 1, 0.36, 1); only transform and
//             opacity move; reveals rise 32px once; loading = skeletons.
//
// The page tells one story (papi, 2026-11-09): a round table where a PM, a
// designer and a developer meet the AI (3D, scroll driven), then the same
// story on the real board, then the visitor settles the clash themselves.
// Orange appears only in the 3D scene, and only for the AI.
//
// Sections, top to bottom (components/landing/studio/):
//   Nav · Story (hero + 4 chapters + tagline) · RealBoard · TryIt ·
//   Proof (hidden until real quotes) · Pricing · Faq · Footer (final CTA)
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Faq } from "@/components/landing/studio/Faq";
import { Footer } from "@/components/landing/studio/Footer";
import { MotionRoot } from "@/components/landing/studio/motion";
import { Nav } from "@/components/landing/studio/Nav";
import { Pricing } from "@/components/landing/studio/Pricing";
import { Proof } from "@/components/landing/studio/Proof";
import { RealBoard } from "@/components/landing/studio/RealBoard";
import { Story } from "@/components/landing/studio/Story";
import { TryIt } from "@/components/landing/studio/TryIt";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Wireframe Studio: your team talks, one plan comes out",
  description:
    "Put your PM, designer and developer at one table. An AI teammate reads every note, settles the clashes out loud and draws the screens for everyone. Runs on your own AI key.",
};

export default function LandingPage() {
  return (
    <div className={`${geist.className} min-h-full bg-void text-ink antialiased`}>
      <a
        href="#main"
        className="button-sm fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-accent px-3 py-2 transition-transform duration-300 focus:translate-y-0"
      >
        Skip to content
      </a>
      <MotionRoot>
        <Nav />
        <main id="main">
          <Story />
          <RealBoard />
          <TryIt />
          <Proof />
          <Pricing />
          <Faq />
        </main>
        <Footer />
      </MotionRoot>
    </div>
  );
}
