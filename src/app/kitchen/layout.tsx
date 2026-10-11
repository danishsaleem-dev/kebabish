import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth, homeForRole } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import { inter, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import { FullscreenButton } from "@/components/kitchen/KitchenBoard";
import "../globals.css";

export const metadata: Metadata = {
  title: "Kitchen | Kebabish",
  robots: { index: false, follow: false },
};

/**
 * The kitchen's screen. Structurally separate from /admin, /rider and
 * /dashboard (see CLAUDE.md), allow-listed rather than deny-listed: the kitchen
 * role, plus owner/staff/manager who may want to look at it. A rider or
 * customer landing here bounces to their own home.
 */
export default async function KitchenLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager") {
    redirect(homeForRole(role));
  }

  return (
    <html lang="en" className={`${inter.variable} ${bitter.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>
          <header className="sticky top-0 z-10 border-b border-hairline bg-panel">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo/Kebabish-light.png"
                  alt="Kebabish"
                  width={300}
                  height={225}
                  priority
                  className="h-8 w-auto"
                />
                <span className="font-display text-base font-semibold text-heading">Kitchen</span>
              </div>
              <div className="flex items-center gap-1">
                <FullscreenButton />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-canvas hover:text-danger"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </AppShellBody>
      </body>
    </html>
  );
}
