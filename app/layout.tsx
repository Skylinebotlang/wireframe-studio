// ─────────────────────────────────────────────────────────────────────────────
// APP SHELL — loads the three fonts and wraps every page.
//
// Fonts (from the design direction):
//   Inter Tight    → big landing-page headlines
//   Bulzing        → headings / wordmark (local file in app/fonts/, freeware,
//                    NON-COMMERCIAL licence: buy a commercial one before launch)
//   IBM Plex Sans  → body text
//   IBM Plex Mono  → small labels (uppercase, technical look)
// Each is exposed as a CSS variable that globals.css maps into Tailwind.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const headingFont = localFont({
  src: [
    { path: "./fonts/Bulzing.ttf", style: "normal" },
    { path: "./fonts/Bulzing-Italic.ttf", style: "italic" },
  ],
  variable: "--font-bulzing",
});

const displayFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-inter-tight",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
});

const labelFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Wireframe Studio: multiplayer AI workspace",
  description:
    "A shared canvas where PMs, designers and developers drop prompt notes and an AI agent turns them into wireframes, together.",
  // The site is already dark: tell the Dark Reader extension to leave it
  // alone (it was painting selected sticky notes solid black).
  other: { "darkreader-lock": "true" },
};

// Same message for Chrome's own "auto dark mode" and similar tools.
export const viewport: Viewport = { colorScheme: "dark" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password
    // managers, dark-mode tools…) add attributes to <html>/<body> before React
    // loads, which React reports as a "hydration mismatch". Safe to ignore
    // here: it only covers these two tags, not the rest of the page.
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        // Writing helpers (Grammarly, LanguageTool) draw boxes over text you
        // can edit, like a selected sticky note. Ask them to stay off.
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-lt-active="false"
        className={`${headingFont.variable} ${displayFont.variable} ${bodyFont.variable} ${labelFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
