"use client";

import { useEffect, useState } from "react";

/**
 * Picks and mounts exactly one video source client-side, instead of
 * rendering both the mobile and web `<video autoPlay>` elements and hiding
 * one with CSS. `display:none` does not stop an `autoplay` video from
 * fetching and playing in the background in most browsers — Lighthouse
 * caught both hero-mobile.mp4 and hero-web.mp4 being downloaded on the
 * same (mobile) page load, roughly doubling the hero's network payload for
 * a video the visitor never sees a frame of.
 *
 * Nothing renders until a variant is picked (one tick after mount) — the
 * poster `<Image>` this sits on top of (see Hero.tsx) is what shows in
 * that gap and for no-JS/slow-JS visitors, same as it already did while
 * a video's own `poster` attribute loads.
 */
export default function HeroVideo({
  web,
  mobile,
}: {
  web: boolean;
  mobile: boolean;
}) {
  const [variant, setVariant] = useState<"web" | "mobile" | null>(null);

  useEffect(() => {
    if (!web || !mobile) {
      setVariant(web ? "web" : mobile ? "mobile" : null);
      return;
    }

    // Matches the sm: breakpoint the old CSS-hidden approach used.
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setVariant(mq.matches ? "web" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [web, mobile]);

  if (!variant) return null;

  return (
    <video
      // Remounts on breakpoint changes (e.g. rotating a tablet) so the
      // right source actually loads rather than just relabeling the old one.
      key={variant}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/images/hero-poster.jpg"
      className="absolute inset-0 h-full w-full object-cover"
    >
      <source
        src={variant === "web" ? "/video/hero-web.mp4" : "/video/hero-mobile.mp4"}
        type="video/mp4"
      />
    </video>
  );
}
