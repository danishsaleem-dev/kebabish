"use client";

import { Fragment, useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Continuously scrolling selling-points strip. The track holds two identical
 * copies of the list, so translating it exactly -50% loops seamlessly.
 */
export default function Marquee({ items }: { items: string[] }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tween = gsap.to(el, {
      xPercent: -50,
      duration: Math.max(items.length * 5, 24),
      ease: "none",
      repeat: -1,
    });

    return () => {
      tween.kill();
    };
  }, [items.length]);

  return (
    <div className="relative overflow-hidden border-y border-ember-700/40 bg-ember-600 py-4">
      <div ref={track} className="flex w-max items-center gap-8 sm:gap-12">
        {[0, 1].map((copy) => (
          // The second copy exists purely to make the loop seamless, so it's
          // hidden from assistive tech and the list is only announced once.
          <Fragment key={copy}>
            {items.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                aria-hidden={copy === 1 ? "true" : undefined}
                className="flex shrink-0 items-center gap-8 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.16em] text-cream-100 sm:gap-12 sm:text-base"
              >
                {item}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rotate-45 bg-cream-100/60"
                />
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
