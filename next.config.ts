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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default withNextIntl(nextConfig);
