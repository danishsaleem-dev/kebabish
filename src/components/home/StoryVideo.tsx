"use client";

import { useEffect, useRef, useState } from "react";
import { videoMimeType } from "@/lib/video-config";

/**
 * The looping clip in the story section.
 *
 * It only mounts a `<video>` once the section is actually scrolled near, and
 * never on a connection the browser reports as slow: the hero already spends
 * this page's video budget, and a second autoplaying file at the top of the
 * document would compete with it for bandwidth on exactly the phones that can
 * least afford it. Until then — and for anyone who prefers reduced motion, or
 * has JS off — the poster `<Image>` underneath (see Story.tsx) is what shows,
 * which is the same still the video opens on.
 */
export default function StoryVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string;
  label: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /2g/.test(connection.effectiveType)) return;

    const node = anchor.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      // Start loading a screen early so it is already playing by the time
      // the section is actually looked at.
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={anchor} className="absolute inset-0">
      {show && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          aria-label={label}
          className="h-full w-full animate-[media-fade-in_0.7s_ease-out_both] object-cover"
        >
          <source src={src} type={videoMimeType(src)} />
        </video>
      )}
    </div>
  );
}
