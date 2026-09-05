"use client";

import { useState, type ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import NotificationsMenu from "@/components/admin/NotificationsMenu";
import type { SessionUser } from "@/components/admin/AdminShell";
import type { AdminNotification } from "@/lib/admin/order-types";

/**
 * The interactive chrome: fixed sidebar on desktop, slide-over drawer on
 * mobile, sticky top bar. Split out from AdminShell so the session lookup
 * stays in a Server Component while this keeps its `useState` for the
 * mobile nav toggle.
 */
export default function AdminShellClient({
  title,
  user,
  notifications,
  children,
}: {
  title: string;
  user: SessionUser | undefined;
  notifications: AdminNotification[];
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar user={user} />
      </aside>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-heading/40"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <Sidebar user={user} onClose={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-hairline bg-panel/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-body-text hover:bg-canvas lg:hidden"
            >
              <Menu size={22} />
            </button>

            <h1 className="font-display text-xl font-semibold text-heading">
              {title}
            </h1>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <label className="relative hidden sm:block">
                <span className="sr-only">Search</span>
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  type="search"
                  placeholder="Search in here"
                  className="h-10 w-56 rounded-full border border-hairline bg-panel pl-10 pr-4 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none lg:w-72"
                />
              </label>

              <NotificationsMenu notifications={notifications} />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
