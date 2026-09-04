import { Bitter, Inter } from "next/font/google";

/**
 * Shared across every top-level segment that owns its own <html>/<body>
 * (admin, the auth pages, the customer dashboard) — each is a separate
 * subtree from the public [locale] site, so each needs its own font
 * loading, but they all want the same two fonts.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const bitter = Bitter({
  subsets: ["latin"],
  variable: "--font-bitter",
  display: "swap",
});
