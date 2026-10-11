"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export interface ShowcasePhoto {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * The photo showcase: a mosaic that opens into a lightbox.
 *
 * The tiles themselves are plain `<Image>`s in the server-rendered markup —
 * they are real content on a page whose first priority is SEO, so they are
 * never injected by JS. Only the enlarge-on-click behaviour is client-side,
 * and with JS off the grid is still a perfectly good gallery.
 *
 * Every sixth tile is a 2×2, so the mosaic reads as composed rather than as a
 * uniform grid of thumbnails — and it keeps working at any number of photos,
 * which matters because Danish picks that number in /admin.
 */
export default function ShowcaseGrid({ photos }: { photos: ShowcasePhoto[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const open = openAt != null;

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenAt((current) =>
        current == null ? current : (current + delta + photos.length) % photos.length
      ),
    [photos.length]
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);

    // Stop the page behind the lightbox from scrolling under it.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close, step]);

  const active = openAt == null ? null : photos[openAt];

  return (
    <>
      <ul
        data-reveal-group
        className="grid auto-rows-[minmax(0,1fr)] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {photos.map((photo, i) => {
          const large = i % 6 === 0;
          return (
            <li
              key={photo.id}
              data-reveal
              className={large ? "col-span-2 row-span-2" : ""}
            >
              <button
                type="button"
                onClick={() => setOpenAt(i)}
                className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-cream-300 ring-1 ring-charcoal-600/10 transition-[translate,box-shadow] duration-500 ease-brand hover:-translate-y-1 hover:shadow-xl hover:shadow-charcoal-950/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-600"
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  sizes={
                    large
                      ? "(min-width: 1024px) 50vw, 92vw"
                      : "(min-width: 1024px) 25vw, 46vw"
                  }
                  className="object-cover transition-transform duration-[900ms] ease-brand group-hover:scale-[1.06]"
                />
                <span className="absolute inset-0 bg-charcoal-950/0 transition-colors duration-500 group-hover:bg-charcoal-950/25" />
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-cream-50/90 text-charcoal-600 opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-500 ease-brand group-hover:translate-y-0 group-hover:opacity-100"
                >
                  <Expand size={16} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onClick={close}
          className="fixed inset-0 z-100 flex items-center justify-center bg-charcoal-950/92 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-cream-100/10 text-cream-50 transition-colors hover:bg-cream-100/20 sm:right-6 sm:top-6"
          >
            <X size={22} />
          </button>

          {photos.length > 1 && (
            <>
              <LightboxArrow side="left" onClick={() => step(-1)} />
              <LightboxArrow side="right" onClick={() => step(1)} />
            </>
          )}

          {/* Stop a click on the photo itself from closing the lightbox. */}
          <figure
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-full w-full max-w-4xl"
          >
            <Image
              src={active.url}
              alt={active.alt}
              width={active.width || 1600}
              height={active.height || 1200}
              sizes="(min-width: 1024px) 60vw, 92vw"
              className="mx-auto max-h-[80vh] w-auto rounded-2xl object-contain"
            />
            {active.alt && (
              <figcaption className="mt-4 text-center text-sm text-cream-200/70">
                {active.alt}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </>
  );
}

function LightboxArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream-100/10 text-cream-50 transition-colors hover:bg-cream-100/20 ${
        side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"
      }`}
    >
      <Icon size={26} />
    </button>
  );
}
