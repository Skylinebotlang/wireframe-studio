import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let other laptops on the same Wi-Fi/hotspot open the dev server by IP
  // (e.g. http://172.17.59.93:3000). Next.js blocks this by default.
  // Each * matches one number in the IP address.
  allowedDevOrigins: ["192.168.*.*", "172.*.*.*", "10.*.*.*"],
  // Hide the round "N" Next.js button in the corner (dev only; never on the live site).
  devIndicators: false,
};

export default nextConfig;
