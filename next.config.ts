import type { NextConfig } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS — sent with every page and API answer.
//   HSTS                  browsers always use HTTPS for this site (Vercel already
//                         redirects http → https)
//   nosniff / Referrer / Permissions / frame rules: standard hardening
//   CSP (enforced part)   no plugins, no <base> tricks, forms only post to us,
//                         no other site may frame us
//   CSP (report-only part) the full allow-list (scripts, connections, images,
//                         fonts). It only REPORTS problems in the browser
//                         console for now; switch it to enforced once a real
//                         board has been checked with it (the canvas loads
//                         fonts and icons from cdn.tldraw.com, Liveblocks syncs
//                         over wss://).
// ─────────────────────────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== "production";

const ENFORCED_CSP = ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"].join("; ");

const FULL_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.tldraw.com",
  "font-src 'self' data: https://cdn.tldraw.com",
  `connect-src 'self' https://*.liveblocks.io wss://*.liveblocks.io https://cdn.tldraw.com${dev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  ENFORCED_CSP,
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: ENFORCED_CSP },
  { key: "Content-Security-Policy-Report-Only", value: FULL_CSP },
];

const nextConfig: NextConfig = {
  // Let other laptops on the same Wi-Fi/hotspot open the dev server by IP
  // (e.g. http://172.17.59.93:3000). Next.js blocks this by default.
  // Each * matches one number in the IP address.
  allowedDevOrigins: ["192.168.*.*", "172.*.*.*", "10.*.*.*"],
  // Hide the round "N" Next.js button in the corner (dev only; never on the live site).
  devIndicators: false,
  // Don't advertise "X-Powered-By: Next.js".
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
