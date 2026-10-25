"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Tag, X } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { PromoPopup } from "@/lib/public-promos";

/**
 * The small "a promotion is running" badge in the corner, next to the WhatsApp
 * button: what the offer is, its code, and how long is left. Tapping it puts the
 * code in the basket, exactly like tapping the popup image — the popup is the
 * invitation, this is what stays visible after it has been closed.
 *
 * Quiet by design: one line of text each, no animation beyond a fade, never on
 * checkout/feedback where someone is mid-task, and a visitor can hide it (for the
 * rest of that visit). It shows the newest running promotion. A promotion with no
 * end date shows no countdown rather than an invented one.
 *
 * Client-only and rendered after mount: the remaining time depends on *now*, which
 * the server (and the cached page) can't know, so rendering it there would mismatch.
 */

const STORAGE_KEY = "kebabish-promo-widget-v1";
const QUIET_PATHS = ["/checkout", "/feedback"];

type Units = { d: string; h: string; m: string; s: string };

function formatLeft(ms: number, u: Units) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  return `${m}${u.m} ${String(s).padStart(2, "0")}${u.s}`;
}

export default function PromoWidget({
  promos,
  lifted,
}: {
  promos: PromoPopup[];
  /** True while the WhatsApp button is showing underneath, so the badge sits above it. */
  lifted: boolean;
}) {
  const t = useTranslations("promoWidget");
  const locale = useLocale();
  const pathname = usePathname();
  const { promoCode, setPromoCode } = useCart();

  const promo = promos[0];
  const [now, setNow] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);

  // Start the clock after mount, and tick every second only in the last hour
  // (below that the seconds are shown); otherwise twice a minute is plenty.
  const endsAt = promo?.endsAt ?? null;
  const soon = endsAt !== null && now !== null && endsAt - now < 3_600_000;
  useEffect(() => {
    const first = window.setTimeout(() => {
      setNow(Date.now());
      try {
        setHidden(window.sessionStorage.getItem(STORAGE_KEY));
      } catch {
        // No storage: it just stays visible for the visit.
      }
    }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), soon ? 1000 : 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(tick);
    };
  }, [soon]);

  if (!promo || now === null || hidden === promo.id) return null;
  if (QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (endsAt !== null && endsAt <= now) return null;

  const discount =
    promo.type === "percentage"
      ? `${promo.value}%`
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: Number.isInteger(promo.value) ? 0 : 2,
        }).format(promo.value);

  const added = promoCode === promo.code;
  const left =
    endsAt !== null
      ? t("timeLeft", {
          time: formatLeft(endsAt - now, {
            d: t("unitDay"),
            h: t("unitHour"),
            m: t("unitMinute"),
            s: t("unitSecond"),
          }),
        })
      : null;

  return (
    <div
      className={`print:hidden fixed right-5 z-40 animate-[media-fade-in_0.4s_ease-out_both] motion-reduce:animate-none md:right-7 ${
        lifted
          ? "bottom-[calc(var(--dock,0px)+5.5rem)] md:bottom-[6.75rem]"
          : "bottom-[calc(var(--dock,0px)+1.25rem)] md:bottom-7"
      }`}
    >
      <button
        type="button"
        onClick={() => setPromoCode(promo.code)}
        aria-label={added ? t("added", { code: promo.code }) : `${t("label", { discount })} — ${promo.code}`}
        className="group flex items-center gap-3 rounded-2xl bg-charcoal-600 py-2.5 pl-2.5 pr-4 text-left text-cream-50 shadow-lg shadow-charcoal-950/25 ring-1 ring-cream-100/10 transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ember-600 text-cream-50">
          {added ? <Check size={18} strokeWidth={3} /> : <Tag size={17} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">
            {added ? t("added", { code: promo.code }) : t("label", { discount })}
          </span>
          <span className="mt-0.5 block text-xs leading-tight tabular-nums text-cream-200/75">
            {added ? left ?? promo.code : left ? `${promo.code} · ${left}` : promo.code}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          setHidden(promo.id);
          try {
            window.sessionStorage.setItem(STORAGE_KEY, promo.id);
          } catch {
            // Fine — hidden until the page is reloaded.
          }
        }}
        aria-label={t("hide")}
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-cream-50 text-charcoal-600 shadow transition-colors hover:bg-cream-200"
      >
        <X size={13} />
      </button>
    </div>
  );
}
