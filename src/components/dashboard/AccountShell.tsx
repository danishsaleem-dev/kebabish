import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, LogOut, ShoppingBag } from "lucide-react";
import { signOutAction } from "@/app/logout-action";
import { AccountNavBar, AccountNavList, type NavItem } from "@/components/dashboard/AccountNav";

/**
 * The customer dashboard's chrome: a sidebar from `lg` up, a bottom bar
 * below it — the same split as /admin, so there is one mental model for
 * every signed-in screen on the project.
 *
 * It is a Server Component; only the two nav lists are client-side, because
 * the active item needs the current path. Labels arrive already translated
 * (the dashboard sits outside `[locale]`, so there is no provider in the
 * tree and strings are passed as props, as on the auth pages).
 */
export default function AccountShell({
  items,
  name,
  email,
  labels,
  children,
}: {
  items: NavItem[];
  name: string;
  email: string;
  labels: { menu: string; backToSite: string; signOut: string; orderCta: string };
  /** The page itself. */
  children: ReactNode;
}) {
  const initial = (name || email).trim().charAt(0).toUpperCase() || "K";

  return (
    <div className="min-h-screen bg-canvas">
      {/* ---------------------------------------------- sidebar (lg and up) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-hairline bg-panel lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/logo/Kebabish-light.png"
              alt="Kebabish"
              width={300}
              height={225}
              priority
              className="h-9 w-auto"
            />
          </Link>
        </div>

        <div className="flex items-center gap-3 border-y border-hairline px-5 py-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 font-display text-base font-semibold text-ember-700"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-heading">
              {name || labels.menu}
            </span>
            <span className="block truncate text-xs text-muted">{email}</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AccountNavList items={items} />
        </div>

        <div className="shrink-0 space-y-1 border-t border-hairline p-3">
          <Link
            href="/menu"
            className="flex items-center justify-center gap-2 rounded-xl bg-ember-600 px-3 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <ShoppingBag size={16} aria-hidden="true" />
            {labels.orderCta}
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <ExternalLink size={17} aria-hidden="true" />
            {labels.backToSite}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-danger"
            >
              <LogOut size={17} aria-hidden="true" />
              {labels.signOut}
            </button>
          </form>
        </div>
      </aside>

      {/* ------------------------------------------------- top bar (phones) */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-hairline bg-panel/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/logo/Kebabish-light.png"
                alt="Kebabish"
                width={300}
                height={225}
                priority
                className="h-8 w-auto"
              />
            </Link>
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 rounded-full bg-ember-600 px-3.5 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <ShoppingBag size={14} aria-hidden="true" />
              {labels.orderCta}
            </Link>
          </div>
        </header>

        {/* The bottom bar is ~3.75rem plus the safe area; the padding keeps the
            last card clear of it. */}
        <main className="mx-auto max-w-4xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <AccountNavBar items={items} />
    </div>
  );
}
