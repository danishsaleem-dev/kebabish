"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Quote, Star } from "lucide-react";
import type { Review } from "@/lib/reviews-data";

const AUTOPLAY_MS = 6500;

/**
 * The customer quotes as a swipeable deck with depth: the card in the middle is full
 * size and lit, its neighbours step back and dim, and the deck moves on by itself
 * every few seconds (with a progress bar in the dots) until someone touches it.
 *
 * - **Swipe/scroll is native** (CSS scroll-snap), so a phone's own momentum works and
 *   nothing fights the thumb; the arrows and dots just scroll the same rail.
 * - **Autoplay pauses** while the pointer is over the deck, while anything in it has
 *   keyboard focus, after the visitor scrolls it themselves, when the deck is off
 *   screen or the tab is hidden, and never runs under `prefers-reduced-motion`.
 * - The cursor drags a soft ember spotlight across the card under it (two CSS
 *   variables, set on pointer move — no re-render).
 * - A long review is clamped with "read more", since these are real messages and some
 *   are long; nothing in the text is ever changed.
 *
 * Every review is in the server HTML (this renders on the server first), so the
 * quotes stay crawlable.
 */
export default function ReviewWall({ reviews }: { reviews: Review[] }) {
  const t = useTranslations("home");
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Only run while the deck is actually on screen.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((index: number) => {
    const el = rail.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: "smooth" });
  }, []);

  // Start on the middle review (with three or more), so the deck opens with a card on
  // either side instead of an empty left half. Instant, before anyone is looking.
  useEffect(() => {
    const el = rail.current;
    const start = Math.floor(reviews.length / 2);
    const card = el?.children[start] as HTMLElement | undefined;
    if (!el || !card || reviews.length < 3) return;
    el.scrollLeft = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    // Only on mount: the deck's own scrolling takes over from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which card is nearest the middle — that one is "active".
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const middle = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestDistance = Infinity;
        Array.from(el.children).forEach((child, i) => {
          const c = child as HTMLElement;
          const distance = Math.abs(c.offsetLeft + c.clientWidth / 2 - middle);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        });
        setActive(best);
      });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const running = reviews.length > 1 && visible && !paused && !stopped && !reducedMotion;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => goTo((active + 1) % reviews.length), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [running, active, reviews.length, goTo]);

  const spotlight = (e: React.PointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - box.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - box.top}px`);
  };

  return (
    <div
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={rail}
        onTouchStart={() => setStopped(true)}
        onWheel={(e) => Math.abs(e.deltaX) > Math.abs(e.deltaY) && setStopped(true)}
        // Full-bleed (the parent is the viewport width), with side padding of half the
        // viewport minus half a card, so the first and last card can reach the middle.
        className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-[calc(50%-min(43vw,13rem))] py-6 [scrollbar-width:none] sm:gap-6 sm:px-[calc(50%-14rem)] lg:px-[calc(50%-15rem)]"
      >
        {reviews.map((review, i) => {
          const isActive = i === active;
          const long = review.text.length > 260;
          const open = expanded.has(i);
          return (
            <article
              key={`${review.name}-${i}`}
              onPointerMove={spotlight}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${reviews.length}`}
              className={`group relative w-[min(86vw,26rem)] shrink-0 snap-center overflow-hidden rounded-[1.75rem] border bg-charcoal-800/90 p-7 transition-[transform,opacity,border-color,box-shadow] duration-700 ease-brand sm:w-[28rem] sm:p-8 lg:w-[30rem] ${
                isActive
                  ? "scale-100 border-ember-500/35 opacity-100 shadow-2xl shadow-charcoal-950/60"
                  : "scale-[0.9] border-cream-200/10 opacity-45"
              }`}
            >
              {/* Cursor spotlight. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(201,113,62,0.20), transparent 45%)",
                }}
              />
              <Quote
                aria-hidden="true"
                size={120}
                className="pointer-events-none absolute -right-4 -top-6 text-ember-500/10"
              />

              <div className="relative">
                <div
                  key={isActive ? `on-${active}` : "off"}
                  className="flex items-center gap-1 text-ember-400"
                  role="img"
                  aria-label={t("reviewsRating", { rating: review.rating })}
                >
                  {Array.from({ length: 5 }, (_, star) => (
                    <Star
                      key={star}
                      size={18}
                      aria-hidden="true"
                      className={`${star < review.rating ? "fill-current" : "text-cream-200/20"} ${
                        isActive ? "animate-[star-pop_0.5s_var(--ease-brand)_both] motion-reduce:animate-none" : ""
                      }`}
                      style={isActive ? { animationDelay: `${star * 90}ms` } : undefined}
                    />
                  ))}
                </div>

                <blockquote
                  className={`mt-5 whitespace-pre-line text-pretty text-[1.02rem] leading-relaxed text-cream-100/90 ${
                    long && !open ? "line-clamp-6" : ""
                  }`}
                >
                  {review.text}
                </blockquote>
                {long && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="relative z-10 mt-2 text-sm font-semibold text-ember-400 hover:text-cream-50"
                  >
                    {open ? t("reviewsLess") : t("reviewsMore")}
                  </button>
                )}

                <footer className="mt-7 flex items-center gap-3.5 border-t border-cream-200/10 pt-5">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ember-400 to-ember-700 font-display text-base font-bold text-cream-50 shadow-lg shadow-ember-900/40"
                  >
                    {review.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-semibold text-cream-50">
                      {review.name}
                    </span>
                    {review.source && (
                      <span className="mt-0.5 block text-xs text-cream-200/55">
                        {t("reviewsVia", { source: review.source })}
                      </span>
                    )}
                  </span>
                </footer>
              </div>
            </article>
          );
        })}
      </div>

      {reviews.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              setStopped(true);
              goTo((active - 1 + reviews.length) % reviews.length);
            }}
            aria-label={t("reviewsPrevious")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-200/20 text-cream-100 transition-colors hover:border-ember-500 hover:bg-ember-600"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="flex items-center gap-2">
            {reviews.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setStopped(true);
                  goTo(i);
                }}
                aria-label={`${i + 1} / ${reviews.length}`}
                aria-current={i === active}
                className={`relative h-2 overflow-hidden rounded-full transition-[width,background-color] duration-500 ${
                  i === active ? "w-10 bg-cream-200/20" : "w-2 bg-cream-200/25 hover:bg-cream-200/50"
                }`}
              >
                {i === active && (
                  <span
                    key={`${active}-${running}`}
                    className={`absolute inset-y-0 left-0 rounded-full bg-ember-500 ${
                      running ? "animate-[progress-x_var(--autoplay)_linear_both]" : "w-full"
                    }`}
                    style={{ ["--autoplay" as string]: `${AUTOPLAY_MS}ms` }}
                  />
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setStopped(true);
              goTo((active + 1) % reviews.length);
            }}
            aria-label={t("reviewsNext")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-200/20 text-cream-100 transition-colors hover:border-ember-500 hover:bg-ember-600"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
