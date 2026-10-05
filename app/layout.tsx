// ─────────────────────────────────────────────────────────────────────────────
// APP SHELL — loads the three fonts and wraps every page.
//
// Fonts (from the design direction):
//   Bulzing        → headings (local file in app/fonts/, freeware,
//                    NON-COMMERCIAL licence: buy a commercial one before launch)
//   IBM Plex Sans  → body text
//   IBM Plex Mono  → small labels (uppercase, technical look)
// Each is exposed as a CSS variable that globals.css maps into Tailwind.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const headingFont = localFont({
  src: [
    { path: "./fonts/Bulzing.ttf", style: "normal" },
    { path: "./fonts/Bulzing-Italic.ttf", style: "italic" },
  ],
  variable: "--font-bulzing",
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
  title: "Wireframe Studio — multiplayer AI workspace",
  description:
    "A shared canvas where PMs, designers and developers drop prompt notes and an AI agent turns them into wireframes, together.",
};

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
        className={`${headingFont.variable} ${bodyFont.variable} ${labelFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
