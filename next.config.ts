import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Image uploads go through a server action; the 1 MB default would
      // reject anything but a thumbnail. Multiple originals (up to 10MB
      // each, pre-optimisation) can go in one batch, so this needs real
      // headroom above a single file's cap.
      bodySizeLimit: "40mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stop browsers guessing a file's type from its contents.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't hand the full URL (which can carry an order token) to other sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nobody else may frame the site or the admin (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Switch off powerful browser features the site never uses.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default withNextIntl(nextConfig);
