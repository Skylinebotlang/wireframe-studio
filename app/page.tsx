// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE (launch site v2) — the front door at "/".
// Built with the /launch-site brief: docs/launch-site-v2/BRIEF.md.
// All parts live in app/launch/, all styles in app/launch/launch.css.
//
//   0. Loader       the 3D AI character draws itself in orange while the site
//                   loads, turns solid, waves, and glides into the hero
//                   (LaunchLoader + CharacterDock + agent3d).
//   1. Hero         the first 8 seconds: three people build three screens
//                   that don't match; the AI merges them into one.
//                   "Everybody has the context, not just the AI." (Hero)
//   2. The problem  three setups, no shared picture (ProblemChapter)
//   3. How it works five steps on a live canvas (HowChapter)
//   4. Try it       the clickable demo + bring your own AI (TryChapter)
//   5. Join         Start the chat + footer (FinalChapter)
//
// After the hero, the character shrinks into the top bar as the AI status.
// Colors: wine = people, ORANGE = the AI only.
// The old landing page files (Splash, HeroIntro, Chapters, ...) are no longer
// used by this page but are kept until you decide what to do with them.
// ─────────────────────────────────────────────────────────────────────────────
import { LaunchNav } from "./launch/LaunchNav";
import { Hero } from "./launch/Hero";
import { ProblemChapter } from "./launch/ProblemChapter";
import { HowChapter } from "./launch/HowChapter";
import { TryChapter } from "./launch/TryChapter";
import { FinalChapter, Footer } from "./launch/FinalChapter";
import { CharacterDock } from "./launch/CharacterDock";
import { LaunchLoader } from "./launch/LaunchLoader";
import { ChapterPills, LaunchScroll } from "./launch/LaunchScroll";
import "./launch/launch.css";

export default function LandingPage() {
  return (
    <div className="ls">
      <a href="#main" className="ls-skip">
        Skip to content
      </a>
      <LaunchNav />
      <main id="main" className="dots">
        <Hero />
        <ProblemChapter />
        <HowChapter />
        <TryChapter />
        <FinalChapter />
      </main>
      <Footer />
      <ChapterPills />
      <CharacterDock />
      <LaunchLoader />
      <LaunchScroll />
    </div>
  );
}
