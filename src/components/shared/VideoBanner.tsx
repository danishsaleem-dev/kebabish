"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A looping clip behind a page banner.
 *
 * Same restraint as the story section's: the `<video>` is only mounted once
 * the banner is actually near the viewport, and never when the browser reports
 * save-data or a 2g connection, or when the visitor prefers reduced motion.
 * The poster still sits underneath in the server-rendered markup, so the
 * banner is complete — and legible — before any of this runs, and stays that
 * way if none of it ever does.
 */
export default function VideoBanner({
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
      { rootMargin: "300px 0px" }
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
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
