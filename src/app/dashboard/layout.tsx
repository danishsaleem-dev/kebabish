import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import { inter, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import "../globals.css";

export const metadata: Metadata = {
  title: "My account | Kebabish",
  robots: { index: false, follow: false },
};

/**
 * Customer-only. A staff/owner session landing here (e.g. an old bookmark)
 * bounces to /admin instead of seeing the customer view — the two are kept
 * strictly separate, same as the reverse case in
 * admin/(dashboard)/layout.tsx.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "customer") redirect(homeForRole(session.user.role));

  return (
    <html lang="en" className={`${inter.variable} ${bitter.variable}`}>
      <body className="bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>{children}</AppShellBody>
      </body>
    </html>
  );
}
