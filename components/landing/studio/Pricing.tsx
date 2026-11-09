// ─────────────────────────────────────────────────────────────────────────────
// PRICING / RISK REVERSAL (landing page, /): two cards.
//
// Honest on purpose: plans are not decided yet (notes/PRODUCT.md). Today the
// app costs nothing while in beta, sign up asks for no payment details, and
// people pay their own AI provider for what the agent uses (there is NO free
// built-in AI). The Team card stays a short "Soon" until a real plan exists.
// ─────────────────────────────────────────────────────────────────────────────
import { Check } from "@phosphor-icons/react/ssr";
import { CtaLink } from "./CtaLink";
import { Reveal } from "./motion";

const BETA_FEATURES = [
  "Shared boards for your whole team",
  "Live cursors, notes and screens",
  "A decision log for every clash",
  "Make it real: wireframes to finished designs",
  "Works with your own AI key",
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-6 py-20 md:px-12 md:py-24">
      <Reveal className="max-w-[680px]">
        <h2 className="heading-4 md:heading-2 text-balance">Free during beta. No card needed.</h2>
        <p className="body-3 md:body-7 mt-4 text-pretty text-soft">
          You only pay your AI provider, directly, for what the agent uses.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-5">
        <Reveal className="md:col-span-3">
          <div className="flex h-full flex-col rounded-3xl border border-accent/70 bg-panel p-8 md:p-10">
            <h3 className="title-1">Beta</h3>
            <p className="heading-1 mt-4">
              <span className="heading-4 mr-1 align-top">$</span>0
            </p>
            <ul className="mt-8 flex flex-1 flex-col gap-3">
              {BETA_FEATURES.map((f) => (
                <li key={f} className="body-3 flex items-start gap-3">
                  <Check size={20} className="mt-0.5 shrink-0 text-rose" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <CtaLink />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="md:col-span-2">
          <div className="flex h-full flex-col rounded-3xl border border-edge bg-panel p-8 md:p-10">
            <h3 className="title-1">Team</h3>
            <p className="heading-1 mt-4 text-faint">Soon</p>
            <p className="body-3 mt-8 text-pretty text-soft">
              For companies that want billing, admin and support in one place. We’re shaping it with our first
              teams. Until then, the beta has everything.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
