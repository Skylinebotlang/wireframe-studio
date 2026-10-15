// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER: START THE CHAT — the last call to action, then the footer.
//
// Three cursors (two people in wine, the agent in orange) rest around the
// button: the whole team, already in the room, waiting for you.
// No fake numbers, no logos: just the ask.
// ─────────────────────────────────────────────────────────────────────────────
import Image from "next/image";
import Link from "next/link";
import { Cursor } from "./Cursor";
import { StartChatButton } from "./StartChatButton";

export function FinalChapter() {
  return (
    <section id="start" className="ls-chapter ls-final dots" aria-labelledby="ls-final-title">
      <h2 id="ls-final-title" className="ls-h1 ls-final-title">
        Bring your team to one canvas.
      </h2>
      <p className="ls-body ls-final-body">Make a room, share the link, and start prompting together.</p>
      <div className="ls-final-actions">
        <Cursor name="Priya" className="ls-cur--person ls-final-c1" />
        <Cursor name="Leo" className="ls-cur--person ls-final-c2" />
        <Cursor name="Agent" ai className="ls-final-c3" />
        <StartChatButton />
        <Link href="/login" className="ls-textlink">
          I already have an account
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="ls-footer">
      <div className="ls-brand">
        <Image src="/logo-2d.png" alt="" width={24} height={24} />
        <span>Wireframe Studio</span>
      </div>
      <nav className="ls-footer-links" aria-label="Footer">
        <a href="#try">Try the demo</a>
        <Link href="/signup">Sign up</Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <p className="ls-mono ls-footer-c">© {new Date().getFullYear()} Wireframe Studio</p>
    </footer>
  );
}
