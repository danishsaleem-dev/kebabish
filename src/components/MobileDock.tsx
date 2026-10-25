"use client";

import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Home, MapPin, ShoppingBag, User, UtensilsCrossed } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { useLocation } from "@/components/location/LocationProvider";
import { formatEuro } from "@/lib/money";

/**
 * The phone's order bar — the bottom tab bar food apps have taught everyone to reach
 * for with a thumb. Phones only (`md:hidden`); a laptop has the header.
 *
 *   Home · Menu · [basket] · Deliver to · Account
 *
 * - **The basket** is the raised button in the middle: it shows how many items are in
 *   it and the running total, bumps when something is added, and opens the basket
 *   drawer (or the menu, while the basket is empty).
 * - **Deliver to** shows the town from the address this device gave (or "Deliver to"
 *   until it gave one) and opens the same "Where should we deliver?" dialog.
 * - **Account** links to /dashboard with Next's own `Link`, not the localised one: the
 *   dashboard sits outside the locale routing (a localised link would send an English
 *   visitor to /en/dashboard, which doesn't exist). Signed out, it sends them to /login.
 *
 * Not on /checkout, where the pay button owns the bottom of the screen. While it shows,
 * `html[data-dock]` gives the page room underneath it and lifts the floating WhatsApp,
 * promotion and halal elements above it (see globals.css).
 */
const HIDDEN_ON = ["/checkout"];

export default function MobileDock() {
  const t = useTranslations("dock");
  const pathname = usePathname();
  const { count, subtotal, ready, openDrawer } = useCart();
  const { location, openDialog } = useLocation();

  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (hidden) return;
    document.documentElement.setAttribute("data-dock", "");
    return () => document.documentElement.removeAttribute("data-dock");
  }, [hidden]);

  // Bump the basket when its count goes *up* (not on the first read from storage).
  const [bump, setBump] = useState(0);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (previous.current !== null && count > previous.current) {
      const timer = window.setTimeout(() => setBump((n) => n + 1), 0);
      previous.current = count;
      return () => window.clearTimeout(timer);
    }
    previous.current = count;
  }, [count, ready]);

  if (hidden) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const hasItems = ready && count > 0;

  const tab =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[0.68rem] font-semibold transition-colors active:bg-charcoal-600/5";

  return (
    <nav
      aria-label={t("label")}
      className="print:hidden fixed inset-x-0 bottom-0 z-[45] md:hidden"
    >
      <div className="relative mx-auto max-w-lg rounded-t-[1.75rem] border-t border-charcoal-600/10 bg-cream-50/92 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(20,18,15,0.10)] backdrop-blur-xl">
        <div className="flex items-end">
          <Link
            href="/"
            aria-current={isActive("/") ? "page" : undefined}
            className={`${tab} ${isActive("/") ? "text-ember-600" : "text-charcoal-600/65"}`}
          >
            <Home size={21} aria-hidden="true" strokeWidth={isActive("/") ? 2.4 : 2} />
            {t("home")}
          </Link>
          <Link
            href="/menu"
            aria-current={isActive("/menu") ? "page" : undefined}
            className={`${tab} ${isActive("/menu") ? "text-ember-600" : "text-charcoal-600/65"}`}
          >
            <UtensilsCrossed size={21} aria-hidden="true" strokeWidth={isActive("/menu") ? 2.4 : 2} />
            {t("menu")}
          </Link>

          {/* ---- the basket: raised, in the middle ---------------------- */}
          <div className="flex flex-1 justify-center">
            {hasItems ? (
              <button
                type="button"
                onClick={openDrawer}
                aria-label={t("basketAria", { count, total: formatEuro(subtotal) })}
                className="-mt-7 flex flex-col items-center gap-1"
              >
                <span
                  key={bump}
                  className="relative flex h-15 w-15 items-center justify-center rounded-full bg-ember-600 text-cream-50 shadow-xl shadow-ember-800/35 ring-4 ring-cream-50 animate-[dock-bump_0.45s_var(--ease-brand)] motion-reduce:animate-none"
                >
                  <ShoppingBag size={24} aria-hidden="true" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-charcoal-700 px-1.5 text-xs font-bold tabular-nums text-cream-50 ring-2 ring-cream-50">
                    {count}
                  </span>
                </span>
                <span className="text-[0.7rem] font-bold tabular-nums text-ember-700">{formatEuro(subtotal)}</span>
              </button>
            ) : (
              <Link href="/menu" className="-mt-7 flex flex-col items-center gap-1">
                <span className="flex h-15 w-15 items-center justify-center rounded-full bg-charcoal-600 text-cream-50 shadow-xl shadow-charcoal-950/25 ring-4 ring-cream-50">
                  <ShoppingBag size={24} aria-hidden="true" />
                </span>
                <span className="text-[0.68rem] font-semibold text-charcoal-600/80">{t("order")}</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={openDialog}
            className={`${tab} ${location ? "text-charcoal-600" : "text-charcoal-600/65"}`}
          >
            <span className="relative">
              <MapPin size={21} aria-hidden="true" />
              {location && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-cream-50" />
              )}
            </span>
            <span className="max-w-full truncate px-1">{location ? location.city : t("deliver")}</span>
          </button>
          <NextLink href="/dashboard" className={`${tab} text-charcoal-600/65`}>
            <User size={21} aria-hidden="true" />
            {t("account")}
          </NextLink>
        </div>
      </div>
    </nav>
  );
}
