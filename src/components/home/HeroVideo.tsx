"use client";

import { useEffect, useState } from "react";
import { videoMimeType } from "@/lib/video-config";

/** One clip and its still. `video` is null when that variant has no clip. */
interface Clip {
  video: string | null;
  poster: string;
}

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
export default function HeroVideo({ web, mobile }: { web: Clip; mobile: Clip }) {
  // With only one clip there is nothing to choose, so no effect is needed. With
  // both, the screen width decides — which isn't known until after mount, hence
  // the null until then.
  const only = web.video && !mobile.video ? "web" : mobile.video && !web.video ? "mobile" : null;
  const neither = !web.video && !mobile.video;
  const [wide, setWide] = useState<boolean | null>(null);

  useEffect(() => {
    if (only || neither) return;
    // Matches the sm: breakpoint the old CSS-hidden approach used.
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [only, neither]);

  const variant: "web" | "mobile" | null = neither
    ? null
    : (only ?? (wide === null ? null : wide ? "web" : "mobile"));

  if (!variant) return null;
  const clip = variant === "web" ? web : mobile;

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
      poster={clip.poster}
      className="absolute inset-0 h-full w-full object-cover"
    >
      <source
        src={clip.video!}
        type={videoMimeType(clip.video!)}
      />
    </video>
  );
}
