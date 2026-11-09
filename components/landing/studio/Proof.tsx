// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL PROOF (landing page, /)
//
// PLACEHOLDERS ON PURPOSE: we never invent testimonials (skill B8). Each
// {{...}} marks a fact still missing. Replace them with a real quote, name,
// role and company from a beta team (with their OK) and set `real: true`.
// HIDDEN until at least one quote is real: a section made only of
// placeholders makes the page look unfinished (papi's call, 2026-11-09).
// ─────────────────────────────────────────────────────────────────────────────
import { Reveal } from "./motion";

const QUOTES = [
  { quote: "{{testimonial}}", who: "{{name}}, {{role}} at {{company}}", real: false },
  { quote: "{{testimonial}}", who: "{{name}}, {{role}} at {{company}}", real: false },
  { quote: "{{testimonial}}", who: "{{name}}, {{role}} at {{company}}", real: false },
];

export function Proof() {
  const quotes = QUOTES.filter((q) => q.real);
  if (quotes.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 py-20 md:px-12 md:py-24">
      <Reveal className="max-w-[680px]">
        <h2 className="heading-4 md:heading-2 text-balance">What teams on the beta say</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {quotes.map((q, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <figure className="flex h-full flex-col justify-between gap-10 rounded-3xl border border-edge bg-panel p-8">
              {/* The opening quote mark hangs outside the text edge, so the words line up by eye */}
              <blockquote className="title-2 text-soft">
                <span className="-ml-2">“</span>
                {q.quote}”
              </blockquote>
              <figcaption className="caption-2 text-faint">{q.who}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
