import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import { inter, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import "../globals.css";

export const metadata: Metadata = {
  title: "Rider | Kebabish",
  robots: { index: false, follow: false },
};

/**
 * Rider-only, structurally separate from /admin and /dashboard the same
 * way those two are separate from each other — see CLAUDE.md. Allow-listed
 * to "rider" specifically rather than "not owner/staff", so an owner/staff
 * or customer session landing here (old bookmark) bounces to their own
 * home instead of falling through.
 */
export default async function RiderLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "rider") redirect(homeForRole(session.user.role));

  return (
    <html lang="en" className={`${inter.variable} ${bitter.variable}`}>
      <body className="bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>{children}</AppShellBody>
      </body>
    </html>
  );
}
