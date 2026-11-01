"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { useLocation } from "@/components/location/LocationProvider";
import { useIsGuest } from "@/components/rewards/useIsGuest";

/**
 * The small card that tells a signed-out visitor about points. It sits above the halal seal in
 * the bottom-left corner and waits its turn: it stays away until the address dialog is closed,
 * and never interrupts someone paying or reading about rewards already. Closing it is
 * remembered for a week. Client-only, so a crawler never sees it.
 */

const STORAGE_KEY = "kebabish-rewards-nudge-v1";
const QUIET_DAYS = 7;
const SHOW_AFTER_MS = 9000;
const QUIET_PATHS = ["/cart", "/checkout", "/feedback", "/rewards", "/referral"];

function closedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(at) && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export default function RewardsNudge() {
  const t = useTranslations("rewards");
  const locale = useLocale();
  const pathname = usePathname();
  const { rewards } = useCart();
  const { dialogOpen } = useLocation();
  const guest = useIsGuest();
  const [show, setShow] = useState(false);

  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!rewards || !guest || quiet || dialogOpen || show) return;
    const timer = window.setTimeout(() => {
      if (!closedRecently()) setShow(true);
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [rewards, guest, quiet, dialogOpen, show]);

  if (!show || !rewards || quiet || dialogOpen) return null;

  function close() {
    setShow(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Fine: it may come back on the next visit.
    }
  }

  const points = rewards.welcomePoints.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");

  return (
    <aside
      aria-label={t("eyebrow")}
      className="print:hidden fixed bottom-[calc(var(--dock,0px)+5.5rem)] left-3 z-40 w-[min(19rem,calc(100vw-6.5rem))] animate-[media-fade-in_0.4s_ease-out_both] rounded-2xl bg-charcoal-800 p-4 text-cream-100 shadow-xl shadow-charcoal-950/30 ring-1 ring-cream-100/10 motion-reduce:animate-none sm:bottom-[calc(var(--dock,0px)+8rem)] sm:left-5"
    >
      <button
        type="button"
        onClick={close}
        aria-label={t("nudgeClose")}
        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream-50 text-charcoal-600 shadow transition-colors hover:bg-cream-200"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ember-600 text-cream-50">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-snug text-cream-50">
            {rewards.welcomePoints > 0 ? t("nudgeTitle", { points }) : t("eyebrow")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-cream-200/75">
            {rewards.welcomePoints > 0 ? t("nudgeText") : t("nudgeTextPlain")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <NextLink
          href={`/signup?lang=${locale}`}
          onClick={close}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-ember-600 px-3 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {t("nudgeCta")}
        </NextLink>
        <Link href="/rewards" className="shrink-0 text-xs font-semibold text-cream-100 underline underline-offset-2">
          {t("nudgeHow")}
        </Link>
      </div>
    </aside>
  );
}
