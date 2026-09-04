import type { ReactNode } from "react";

/**
 * Pass-through root layout.
 *
 * `<html>` and `<body>` are owned by `[locale]/layout.tsx` (which needs the
 * resolved locale for `lang` and the font variables) and by `not-found.tsx`.
 * Rendering them here as well would nest a second <html> inside the first —
 * invalid markup, and it caused a hydration mismatch on every page.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
