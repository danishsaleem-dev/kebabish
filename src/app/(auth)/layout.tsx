import type { Metadata } from "next";
import type { ReactNode } from "react";
import { inter, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import "../globals.css";

/**
 * Wraps /login and /signup. A route group ("(auth)"), so it doesn't add a
 * URL segment — both stay at the flat /login and /signup, but share this
 * layout on disk. Unguarded: these are the pages an unauthenticated visitor
 * is trying to reach.
 */

export const metadata: Metadata = {
  title: "Sign in | Kebabish",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bitter.variable}`}>
      <body className="bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>{children}</AppShellBody>
      </body>
    </html>
  );
}
