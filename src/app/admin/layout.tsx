import type { Metadata } from "next";
import type { ReactNode } from "react";
import { inter, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import "../globals.css";

/**
 * The admin panel is deliberately locale-independent — it sits outside the
 * [locale] segment so it never picks up the public site's chrome (header,
 * footer, floating WhatsApp button) or the nl/en URL prefixes. `src/proxy.ts`
 * already excludes /admin from the next-intl middleware. It owns its own
 * <html>/<body>, which the pass-through root layout allows.
 *
 * Unguarded — the auth check lives in `(dashboard)/layout.tsx` so `/login`
 * (now its own top-level route, shared with the customer side) never loops
 * back through a redirect here.
 */

export const metadata: Metadata = {
  title: {
    default: "Admin | Kebabish",
    template: "%s | Kebabish Admin",
  },
  // Internal tooling: keep it out of search results entirely.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bitter.variable}`}>
      <body className="bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>{children}</AppShellBody>
      </body>
    </html>
  );
}
