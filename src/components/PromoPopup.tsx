"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, Tag, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { PromoPopup as PromoPopupData } from "@/lib/public-promos";

/**
 * The promotion popup: a promo code's image, shown over the page when a visitor
 * arrives. Tapping the image saves the code with their basket (see `promoCode` in
 * CartProvider), and checkout then applies it for them.
 *
 * Deliberately restrained, because a popup is the easiest thing on a website to
 * make annoying:
 *  - it waits a moment (`SHOW_AFTER_MS`) so it never competes with the page
 *    loading, and never appears on the cart, checkout or feedback pages, where
 *    someone is in the middle of something;
 *  - **it appears only once its image has loaded.** The image is fetched in the
 *    background first; an empty frame while a photo trickles in over a slow
 *    connection is worse than no popup, and an image that fails to load means no
 *    popup at all;
 *  - closing it is remembered for `QUIET_DAYS` days *per promotion* (a different,
 *    newer promotion can still appear), and so is claiming it;
 *  - it doesn't appear for a code the visitor already has in their basket, or
 *    while the basket drawer is open;
 *  - one popup per visit: closing it never rolls straight into the next one.
 * Nothing renders on the server, so there is no layout shift and nothing for a
 * crawler to index.
 */

const SHOW_AFTER_MS = 1800;
const QUIET_DAYS = 3;
const STORAGE_KEY = "kebabish-promo-popup-v1";
/** Pages where a popup would get in the way of finishing an order. */
const QUIET_PATHS = ["/cart", "/checkout", "/feedback"];
const IMAGE_SIZES = "(min-width: 768px) 720px, 92vw";

type Seen = Record<string, number>;

function readSeen(): Seen {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Seen) : {};
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  try {
    const seen = readSeen();
    seen[id] = Date.now();
    // Don't let the record grow forever with promotions that no longer exist.
    const cutoff = Date.now() - QUIET_DAYS * 86_400_000 * 4;
    for (const key of Object.keys(seen)) if (seen[key] < cutoff) delete seen[key];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // No storage (private mode): it may show again next visit, which is harmless.
  }
}

export default function PromoPopup({ promos }: { promos: PromoPopupData[] }) {
  const t = useTranslations("promoPopup");
  const pathname = usePathname();
  const { ready, promoCode, setPromoCode, drawerOpen, count } = useCart();

  // The promotion chosen for this visit, once the delay has passed and its image
  // has loaded — three independent facts, so "open" is simply all of them at once.
  const [candidate, setCandidate] = useState<PromoPopupData | null>(null);
  const [delayDone, setDelayDone] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const [stage, setStage] = useState<"offer" | "added">("offer");

  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const open = Boolean(candidate && delayDone && imageReady && !closed && !quiet && !drawerOpen);

  // Choose a promotion once the basket has been read (the visitor may already
  // hold a code). Set from a timer callback, not the effect body.
  useEffect(() => {
    if (!ready || closed || candidate || promos.length === 0) return;

    const seen = readSeen();
    const quietMs = QUIET_DAYS * 86_400_000;
    const pick = promos.find(
      (p) => p.code !== promoCode && !(seen[p.id] && Date.now() - seen[p.id] < quietMs)
    );
    if (!pick) return;

    const choose = window.setTimeout(() => setCandidate(pick), 0);
    return () => window.clearTimeout(choose);
  }, [ready, closed, candidate, promos, promoCode]);

  // The pause before showing anything runs from when the page loads, in its own
  // effect: tied to the one above, choosing a promotion would re-run that effect
  // and its cleanup would cancel this timer before it ever fired.
  useEffect(() => {
    const delay = window.setTimeout(() => setDelayDone(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(delay);
  }, []);

  const close = useCallback(() => {
    if (candidate) markSeen(candidate.id);
    setClosed(true);
    returnFocus.current?.focus?.();
  }, [candidate]);

  // While it's open: Escape closes, Tab stays inside, the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;

    returnFocus.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The image is the main action, so that is where focus starts.
    dialogRef.current?.querySelector<HTMLElement>("[data-promo-claim]")?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  function claim(promo: PromoPopupData) {
    setPromoCode(promo.code);
    markSeen(promo.id);
    setStage("added");
  }

  // Once the confirmation is up, focus its main button.
  useEffect(() => {
    if (open && stage === "added") {
      dialogRef.current?.querySelector<HTMLElement>("[data-promo-next]")?.focus();
    }
  }, [open, stage]);

  if (!candidate || closed) return null;

  // Fetch the image in the background until it is ready. Same URL and sizes as the
  // one the popup shows, so the browser reuses the download. If it fails, nothing
  // ever appears.
  if (!imageReady) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0">
        <Image
          src={candidate.imageUrl}
          alt=""
          width={candidate.width}
          height={candidate.height}
          sizes={IMAGE_SIZES}
          loading="eager"
          onLoad={() => setImageReady(true)}
        />
      </div>
    );
  }

  if (!open) return null;

  const hasBasket = count > 0;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal-950/65 p-4 backdrop-blur-[3px] animate-[media-fade-in_0.3s_ease-out_both] motion-reduce:animate-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={candidate.alt}
        className="relative flex max-h-full w-full max-w-[26rem] flex-col items-center md:max-w-[45rem]"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="absolute -right-1 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-cream-50 text-charcoal-600 shadow-lg transition-colors hover:bg-cream-200 sm:-right-3"
        >
          <X size={20} />
        </button>

        {stage === "offer" ? (
          <>
            <button
              type="button"
              data-promo-claim
              onClick={() => claim(candidate)}
              className="group block max-w-full overflow-hidden rounded-3xl bg-charcoal-800 shadow-2xl ring-1 ring-cream-100/20 transition-transform duration-300 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ember-500/70"
            >
              <Image
                src={candidate.imageUrl}
                alt={candidate.alt}
                width={candidate.width}
                height={candidate.height}
                sizes={IMAGE_SIZES}
                loading="eager"
                className="h-auto max-h-[70svh] w-auto max-w-full object-contain md:max-h-[calc(100svh-10rem)]"
              />
            </button>

            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2 text-center text-sm font-semibold text-charcoal-600 shadow-lg">
              <Tag size={15} className="shrink-0 text-ember-600" />
              {t("claimHint", { code: candidate.code })}
            </p>
          </>
        ) : (
          <div className="w-full rounded-3xl bg-cream-50 p-6 text-center shadow-2xl sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ember-600 text-cream-50">
              <Check size={28} strokeWidth={3} />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-charcoal-600">
              {t("addedTitle", { code: candidate.code })}
            </h2>
            <p className="mt-2 text-pretty text-sm text-ink/70">{t("addedText")}</p>
            <Link
              data-promo-next
              href={hasBasket ? "/checkout" : "/menu"}
              onClick={close}
              className="mt-6 block rounded-full bg-ember-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              {hasBasket ? t("toCheckout") : t("toMenu")}
            </Link>
            <button
              type="button"
              onClick={close}
              className="mt-2 w-full rounded-full px-6 py-3 text-sm font-semibold text-charcoal-600/70 transition-colors hover:text-charcoal-600"
            >
              {t("close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
