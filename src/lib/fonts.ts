import { Bitter, Poppins } from "next/font/google";

/**
 * Shared across every top-level segment that owns its own <html>/<body>
 * (admin, the auth pages, the customer dashboard) — each is a separate
 * subtree from the public [locale] site, so each needs its own font
 * loading, but they all want the same two fonts.
 */
// Poppins is not a variable font, so the weights are listed: 400 body, 500 medium,
// 600 semibold (buttons, labels) and 700 bold are every weight the site uses.
export const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const bitter = Bitter({
  subsets: ["latin"],
  variable: "--font-bitter",
  display: "swap",
});
