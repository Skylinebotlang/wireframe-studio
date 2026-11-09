// ─────────────────────────────────────────────────────────────────────────────
// THE REAL BOARD (landing page, /): right after the story, the same
// checkout story on the actual product: three notes, one agent run, two
// screens (ProductMock plays it when it scrolls into view).
// ─────────────────────────────────────────────────────────────────────────────
import { Reveal } from "./motion";
import { ProductMock } from "./ProductMock";

export function RealBoard() {
  return (
    <section id="board" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-6 py-20 md:px-12 md:py-24">
      <Reveal className="max-w-[680px]">
        <h2 className="heading-4 md:heading-2 text-balance">The same story, on the real board</h2>
        <p className="body-3 md:body-7 mt-4 text-pretty text-soft">
          Three notes, one run, two screens. This is what your team sees, live, while the agent works.
        </p>
      </Reveal>
      <Reveal className="mt-12">
        <ProductMock />
      </Reveal>
    </section>
  );
}
