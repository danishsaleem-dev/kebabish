"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

/**
 * The dish photos.
 *
 * A dish usually has one, and then this is exactly what the page had before:
 * a single rounded frame, no controls, nothing to learn. From the second photo
 * on it becomes a gallery — arrows, a thumbnail strip, a counter — because
 * until now any photo after the first was uploaded in /admin and then never
 * shown anywhere, which is the bug this fixes.
 *
 * Every photo is in the server-rendered HTML (the inactive ones hidden, not
 * absent) so all of them are crawlable and the next one is already decoded
 * when it is asked for: switching is a cross-fade, never a flash of empty
 * frame. Tapping the photo opens it full-screen for the detail that matters
 * on food — the char on a kebab, the garnish on a biryani.
 */
export default function ItemGallery({
  images,
  alt,
  photoLabels,
  zoomLabel,
  closeLabel,
  previousLabel,
  nextLabel,
}: {
  images: string[];
  alt: string;
  /**
   * "Photo 2 of 4" for each image, formatted by the (server) caller — a
   * function prop can't cross the server/client boundary, so the strings
   * come over already built.
   */
  photoLabels: string[];
  zoomLabel: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const total = images.length;
  const many = total > 1;

  const step = useCallback(
    (delta: number) => setIndex((i) => (i + delta + total) % total),
    [total]
  );

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
      if (many && event.key === "ArrowRight") step(1);
      if (many && event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [zoomed, many, step]);

  return (
    <div>
      <div className="group relative aspect-4/3 overflow-hidden rounded-3xl bg-cream-300">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === 0 ? alt : ""}
            fill
            // Only the one on screen is urgent; the rest still load, just
            // without competing with it for the largest-paint slot.
            priority={i === 0}
            sizes="(min-width: 1024px) 45vw, 92vw"
            aria-hidden={i === index ? undefined : true}
            className={`object-cover transition-opacity duration-500 ease-brand ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Sits above the photos; the arrows below sit above this in turn. */}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={zoomLabel}
          className="absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-600"
        >
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-cream-50/90 text-charcoal-600 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ZoomIn size={17} />
          </span>
        </button>

        {many && (
          <>
            <GalleryArrow side="left" label={previousLabel} onClick={() => step(-1)} />
            <GalleryArrow side="right" label={nextLabel} onClick={() => step(1)} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 rounded-full bg-charcoal-950/55 px-2.5 py-1 text-xs font-semibold tabular-nums text-cream-50 backdrop-blur-sm"
            >
              {index + 1}/{total}
            </span>
          </>
        )}
      </div>

      {many && (
        <ul
          className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1"
          aria-label={alt}
        >
          {images.map((src, i) => (
            <li key={src} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={photoLabels[i]}
                aria-current={i === index}
                className={`relative block h-16 w-20 overflow-hidden rounded-xl transition-[opacity,box-shadow] duration-300 sm:h-20 sm:w-24 ${
                  i === index
                    ? "ring-2 ring-ember-600 ring-offset-2 ring-offset-cream-200"
                    : "opacity-65 hover:opacity-100"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-100 flex items-center justify-center bg-charcoal-950/92 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label={closeLabel}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-100/10 text-cream-50 transition-colors hover:bg-cream-100/20 sm:right-6 sm:top-6"
          >
            <X size={22} />
          </button>

          {many && (
            <>
              <GalleryArrow side="left" label={previousLabel} onClick={() => step(-1)} overlay />
              <GalleryArrow side="right" label={nextLabel} onClick={() => step(1)} overlay />
            </>
          )}

          <Image
            src={images[index]}
            alt={alt}
            width={1600}
            height={1200}
            sizes="(min-width: 1024px) 70vw, 92vw"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[82vh] w-auto rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  label,
  onClick,
  overlay,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  /** In the full-screen view the arrows are always visible, not on hover. */
  overlay?: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={
        overlay
          ? `absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream-100/10 text-cream-50 transition-colors hover:bg-cream-100/20 ${
              side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"
            }`
          : // On a touch screen there is no hover, so these stay visible; on a
            // pointer device they fade in with the card.
            `absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/90 text-charcoal-600 shadow-sm backdrop-blur-sm transition-opacity duration-300 hover:bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-600 motion-safe:sm:opacity-0 motion-safe:sm:group-hover:opacity-100 ${
              side === "left" ? "left-3" : "right-3"
            }`
      }
    >
      <Icon size={20} />
    </button>
  );
}
