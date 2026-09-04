"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Respect the OS setting — no animation at all when reduced motion is on.
 * useSyncExternalStore rather than useState+useEffect so there's no
 * setState-during-effect render cascade, and SSR gets a stable `false`.
 */
export function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(REDUCED_QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens an array of numbers toward `target` on every change.
 *
 * This is what makes the charts *morph* when a filter changes rather than
 * snapping to the new shape — CSS can't interpolate an SVG path's `d`, so the
 * underlying values are interpolated instead and the path is recomputed each
 * frame.
 */
export function useAnimatedNumbers(target: number[], duration = 750): number[] {
  const reduced = usePrefersReducedMotion();
  const [values, setValues] = useState<number[]>(() => target.map(() => 0));

  // Where the last tween got to, so interrupting one mid-flight resumes from
  // the current shape rather than snapping. Written only inside the animation
  // callback — never during render.
  const latestRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);

  // Depend on the contents, not the array identity, so callers don't have to
  // memoise their data.
  const key = target.join(",");

  useEffect(() => {
    if (reduced) return;

    // First run starts from zero, which gives the charts their draw-in.
    const from = target.map((_, i) => latestRef.current[i] ?? 0);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      const next = target.map((v, i) => from[i] + (v - from[i]) * e);
      latestRef.current = next;
      setValues(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration, reduced]);

  return reduced ? target : values;
}

/** Fires once the element scrolls into view — used to trigger draw-in. */
export function useInView<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
