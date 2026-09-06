"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIncreasing,
  ChevronDown,
  Images,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageCircle,
  ReceiptText,
  Settings,
  UserCog,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/logout-action";
import type { SessionUser } from "@/components/admin/AdminShell";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  children?: { label: string; href: string }[];
};

const MAIN: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ReceiptText,
    children: [
      { label: "All orders", href: "/admin/orders" },
      { label: "New", href: "/admin/orders/new" },
      { label: "Completed", href: "/admin/orders/completed" },
    ],
  },
  {
    label: "Menu",
    href: "/admin/menu",
    icon: UtensilsCrossed,
    children: [
      { label: "All items", href: "/admin/menu" },
      { label: "Categories", href: "/admin/menu/categories" },
      { label: "Recipes", href: "/admin/menu/recipes" },
      { label: "Extras", href: "/admin/menu/extras" },
      { label: "Ingredients", href: "/admin/menu/ingredients" },
      { label: "Allergens", href: "/admin/menu/allergens" },
      { label: "Production planner", href: "/admin/menu/production" },
    ],
  },
  { label: "Media", href: "/admin/media", icon: Images },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Reports", href: "/admin/reports", icon: ChartColumnIncreasing },
  { label: "Messages", href: "/admin/messages", icon: MessageCircle },
];

const OTHERS: NavItem[] = [
  {
    label: "Marketing",
    href: "/admin/marketing",
    icon: Megaphone,
    children: [
      { label: "Promo codes", href: "/admin/marketing/promotions" },
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
    ],
  },
  { label: "Team", href: "/admin/team", icon: UserCog },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function Sidebar({
  user,
  onClose,
}: {
  user: SessionUser | undefined;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col border-r border-hairline bg-panel">
      <div className="flex items-center justify-between px-5 py-5">
        {/* The supplied logo is a stacked lockup that already contains the
            wordmark, so it stands alone here rather than sitting next to a
            duplicate "Kebabish" label. */}
        <Link href="/admin" aria-label="Kebabish admin">
          <Image
            src="/logo/Kebabish-light.png"
            alt="Kebabish"
            width={440}
            height={330}
            priority
            className="h-12 w-auto"
          />
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas lg:hidden"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* account card */}
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-xl border border-hairline p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600 font-display text-sm font-semibold text-cream-50">
          {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-heading">
            {user?.name || user?.email || "Signed in"}
          </p>
          <p className="truncate text-xs capitalize text-muted">
            {user?.role ?? ""}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-canvas hover:text-danger"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <ul className="space-y-1">
          {MAIN.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </ul>

        <p className="px-3 pb-2 pt-6 text-xs font-semibold text-faint">Others</p>
        <ul className="space-y-1">
          {OTHERS.map((item) => (
            <NavRow key={item.href} item={item} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href);
  const [open, setOpen] = useState(active && Boolean(item.children));

  const Icon = item.icon;

  return (
    <li>
      <div
        className={`group flex items-center rounded-xl transition-colors ${
          active ? "bg-canvas" : "hover:bg-canvas"
        }`}
      >
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
        >
          <Icon
            size={19}
            className={active ? "text-ember-600" : "text-muted"}
          />
          <span
            className={`truncate text-sm ${
              active ? "font-semibold text-heading" : "font-medium text-body-text"
            }`}
          >
            {item.label}
          </span>
        </Link>

        {item.children && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Toggle ${item.label}`}
            aria-expanded={open}
            className="mr-2 flex h-7 w-7 items-center justify-center rounded-md text-faint hover:text-muted"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {item.children && open && (
        <ul className="mt-1 space-y-0.5 border-l border-hairline pl-4 ml-6">
          {item.children.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-canvas ${
                  pathname === child.href
                    ? "font-semibold text-ember-600"
                    : "text-muted"
                }`}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
