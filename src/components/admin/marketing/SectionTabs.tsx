"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The five screens of the section, as tabs.
 *
 * A client component because the active tab needs the path — the same reason
 * `AccountNav` and the sidebar's own `NavRow` are client components. The
 * sidebar has these as sub-links too; the tabs are what makes moving between
 * them one click rather than two.
 */

const TABS = [
  { label: "Overview", href: "/admin/marketing/email" },
  { label: "Compose", href: "/admin/marketing/email/compose" },
  { label: "Campaigns", href: "/admin/marketing/email/campaigns" },
  { label: "Contacts", href: "/admin/marketing/email/contacts" },
  { label: "Settings", href: "/admin/marketing/email/settings" },
];

export default function SectionTabs() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin/marketing/email"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm transition-colors ${
              active
                ? "bg-ember-600 font-semibold text-cream-50"
                : "font-medium text-muted hover:bg-canvas hover:text-heading"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
