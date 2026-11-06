"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, ReceiptText, UserRound } from "lucide-react";

/** The four sections. Rewards drops out entirely while the points programme is off. */
export type NavKey = "home" | "orders" | "rewards" | "account";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  /** Shown as a small count on the icon — unrated deliveries, new points. */
  badge?: number;
};

const ICONS: Record<NavKey, typeof Home> = {
  home: Home,
  orders: ReceiptText,
  rewards: Gift,
  account: UserRound,
};

/**
 * `/dashboard` only matches exactly — otherwise it would light up on every
 * child page, since they all start with it.
 */
function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-600 px-1 text-[0.625rem] font-bold leading-none text-cream-50"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** The sidebar list, from `lg` up. */
export function AccountNavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-ember-600/10 text-ember-700"
                : "text-body-text hover:bg-canvas hover:text-heading"
            }`}
          >
            <span className="relative flex shrink-0">
              <Icon size={19} aria-hidden="true" />
              {item.badge ? <Badge count={item.badge} /> : null}
            </span>
            {item.label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ember-600"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The bottom bar on phones and tablets. Fixed, above everything, with room
 * for the home-indicator strip on an iPhone. The dashboard has its own
 * `<html>`, so it never meets the public site's own bottom dock — but the
 * page still needs the matching `pb-*` the layout adds, or the last card
 * sits under the bar.
 */
export function AccountNavBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-semibold transition-colors ${
                  active ? "text-ember-700" : "text-muted"
                }`}
              >
                <span
                  className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-ember-600/10" : ""
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                  {item.badge ? <Badge count={item.badge} /> : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
