"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SCREENSHOT — turn one design's HTML into a PNG, right in the browser.
//
// The review pass ("design director") looks at this picture as well as the
// HTML, so it can see what actually renders: overlaps, cut-off text, cramped
// spacing, weak contrast.
//
// How: the page goes inside an SVG <foreignObject>, the browser paints that
// SVG into a canvas, and the canvas becomes a PNG. No server, no library.
// Works because designs are self-contained (no outside images or fonts:
// lib/agent-design.ts rejects them).
//
// ponytail: foreignObject rendering is close to, not identical to, a real
// page (system fonts, no hover). Swap for server-side headless Chrome if the
// review needs pixel-perfect shots. Returns null if anything fails; the
// review then works from the HTML alone, as before.
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 4000;

export async function screenshotHtml(html: string, width: number, height: number): Promise<string | null> {
  try {
    // foreignObject needs XHTML, so re-serialise the page.
    const doc = new DOMParser().parseFromString(html, "text/html");
    const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
      img.onload = () => (clearTimeout(timer), resolve());
      img.onerror = () => (clearTimeout(timer), reject(new Error("render failed")));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png"); // "data:image/png;base64,…"
  } catch {
    return null;
  }
}
