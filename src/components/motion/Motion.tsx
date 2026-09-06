"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Single mount point for all page motion.
 *
 * Sections stay server components and describe what they want with data
 * attributes, which keeps every word of copy in the server-rendered HTML
 * (SEO is priority #1 on this project) while the animation code lives in
 * one client island.
 *
 *   data-reveal="up|fade|scale|left|right"  reveal once on screen
 *   data-reveal-group                       stagger the reveals inside it
 *   data-reveal-mask                        headline; its grandchildren slide
 *                                           up out of a clipping box
 *   data-parallax="0.12"                    scrubbed parallax drift
 *   data-hero-root                          opted out of the scroll pass and
 *                                           driven by the load timeline below
 *
 * One-shot reveals fire off an IntersectionObserver rather than
 * ScrollTrigger's scroll-position bookkeeping — that bookkeeping has to
 * stay in sync with Lenis' virtualized scroll position and with layout
 * settling after the Bitter/Inter web fonts swap in, and in dev, React's
 * Strict Mode double-invokes this effect, which can wipe a tween's primed
 * starting state out from under the real mount. An IntersectionObserver
 * just answers "is it on screen yet", sidestepping all of that. Scrubbed
 * effects (hero parallax, data-parallax) stay on ScrollTrigger since they
 * track live position every frame rather than doing a one-time check.
 */
export default function Motion() {
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Honour the OS setting: show everything at rest, animate nothing.
    if (reducedMotion) {
      gsap.set("[data-reveal]", { clearProps: "all", opacity: 1 });
      gsap.set("[data-reveal-mask] > * > *", { clearProps: "all", opacity: 1 });
      return;
    }

    // Smooth scrolling on pointer devices only — touch keeps native momentum,
    // which is what actually feels right on a phone.
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const outsideHero = (el: Element) => !el.closest("[data-hero-root]");

    // Plain child/grandchild walk rather than a `:scope` selector — fewer
    // moving parts for something this load-bearing.
    const wordsOf = (headline: Element) =>
      Array.from(headline.children)
        .map((word) => word.children[0])
        .filter((el): el is HTMLElement => el instanceof HTMLElement);

    const restingState = { opacity: 1, y: 0, x: 0, scale: 1 };

    const fromState = (el: Element) => {
      switch ((el as HTMLElement).dataset.reveal) {
        case "fade":
          return { opacity: 0 };
        case "scale":
          return { opacity: 0, scale: 0.94 };
        case "left":
          return { opacity: 0, x: -44 };
        case "right":
          return { opacity: 0, x: 44 };
        default:
          return { opacity: 0, y: 36 };
      }
    };

    /* -----------------------------------------------------------------
     * Prime every below-fold reveal element's hidden starting state up
     * front — before the IntersectionObserver or gsap.context exist, and
     * deliberately NOT inside gsap.context. Anything set inside a context
     * gets undone by that context's revert(), including React Strict
     * Mode's dev-only extra mount/cleanup/mount cycle; priming out here
     * means it always survives to the real, surviving mount.
     * ------------------------------------------------------------- */
    const maskHeadlines = gsap.utils
      .toArray<HTMLElement>("[data-reveal-mask]")
      .filter(outsideHero);
    gsap.set(maskHeadlines.flatMap(wordsOf), { yPercent: 118, opacity: 1 });

    const revealGroups = gsap.utils
      .toArray<HTMLElement>("[data-reveal-group]")
      .filter(outsideHero);
    const grouped = new Set<Element>();
    revealGroups.forEach((group) => {
      group.querySelectorAll<HTMLElement>("[data-reveal]").forEach((item) => {
        grouped.add(item);
        gsap.set(item, fromState(item));
      });
    });

    const soloReveals = gsap.utils
      .toArray<HTMLElement>("[data-reveal]")
      .filter((el) => outsideHero(el) && !grouped.has(el));
    soloReveals.forEach((el) => gsap.set(el, fromState(el)));

    /* -----------------------------------------------------------------
     * One-shot reveal on scroll into view.
     * ------------------------------------------------------------- */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);

          if (el.hasAttribute("data-reveal-mask")) {
            gsap.to(wordsOf(el), {
              yPercent: 0,
              duration: 1.05,
              stagger: 0.055,
              ease: "power4.out",
            });
          } else if (el.hasAttribute("data-reveal-group")) {
            const items = Array.from(
              el.querySelectorAll<HTMLElement>("[data-reveal]")
            );
            gsap.to(items, {
              ...restingState,
              duration: 1,
              ease: "power3.out",
              stagger: 0.085,
            });
          } else {
            gsap.to(el, {
              ...restingState,
              duration: 1,
              ease: "power3.out",
              delay: Number(el.dataset.revealDelay ?? 0),
            });
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );

    [...maskHeadlines, ...revealGroups, ...soloReveals].forEach((el) =>
      observer.observe(el)
    );

    const ctx = gsap.context(() => {
      /* ---------------------------------------------------------------
       * Hero — plays on load rather than on scroll, so it's unaffected
       * by the fold-triggered reveal mechanics above.
       * ------------------------------------------------------------- */
      const hero = document.querySelector("[data-hero-root]");

      if (hero) {
        const q = gsap.utils.selector(hero);
        const heroMask = hero.querySelector("[data-reveal-mask]");
        const titleWords = heroMask ? wordsOf(heroMask) : [];

        gsap.set(titleWords, { yPercent: 118, opacity: 1 });
        gsap.set(q("[data-reveal]"), { opacity: 0, y: 26 });

        const intro = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.9 },
        });

        // Compressed to roughly 60% of the original timing — the title
        // (the page's LCP element) doesn't finish revealing until this
        // whole chain resolves, and the original pacing was measured
        // adding ~2.5s of pure LCP delay with nothing else going on yet.
        // Background zoom/veil are unaffected since they don't gate text
        // visibility; everything downstream of them is what got tightened.
        intro
          .fromTo(
            q("[data-hero-media]"),
            { scale: 1.16 },
            { scale: 1, duration: 2.6, ease: "power2.out" },
            0
          )
          .to(q("[data-hero-veil]"), { opacity: 0, duration: 1.2 }, 0)
          .to(q("[data-hero-mark]"), { opacity: 1, y: 0 }, 0.25)
          .to(q("[data-hero-eyebrow]"), { opacity: 1, y: 0 }, 0.35)
          .to(
            titleWords,
            { yPercent: 0, duration: 0.75, stagger: 0.05, ease: "power4.out" },
            0.45
          )
          .to(q("[data-hero-sub]"), { opacity: 1, y: 0 }, 0.75)
          .to(q("[data-hero-desc]"), { opacity: 1, y: 0 }, 0.85)
          .to(q("[data-hero-cta]"), { opacity: 1, y: 0, stagger: 0.09 }, 0.95)
          .to(q("[data-hero-badge]"), { opacity: 1, y: 0 }, 1.1)
          .to(q("[data-hero-cue]"), { opacity: 1, y: 0 }, 1.25);

        // Media drifts slower than the page; copy lifts away and dims.
        gsap.to(q("[data-hero-media]"), {
          yPercent: 14,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.to(q("[data-hero-copy]"), {
          yPercent: -18,
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      /* ---------------------------------------------------------------
       * Parallax drift — continuous and scroll-position-driven, so it
       * stays on ScrollTrigger rather than the observer above.
       * ------------------------------------------------------------- */
      gsap.utils
        .toArray<HTMLElement>("[data-parallax]")
        .filter(outsideHero)
        .forEach((el) => {
          const strength = Number(el.dataset.parallax || 0.12);
          gsap.fromTo(
            el,
            { yPercent: -strength * 100 },
            {
              yPercent: strength * 100,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement ?? el,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
        });
    });

    // Late-loading images/fonts change section heights; re-measure once
    // settled so the hero's scrubbed ScrollTriggers stay accurate.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);

    return () => {
      window.removeEventListener("load", refresh);
      observer.disconnect();
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
