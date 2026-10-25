"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A description that shows its first few lines and opens in place. The whole text is
 * in the server HTML either way (clamping is only CSS), so nothing is hidden from a
 * crawler; the toggle only appears when the text is actually cut off.
 */
export default function ExpandableText({
  text,
  more,
  less,
  className = "",
}: {
  text: string;
  more: string;
  less: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <p
        ref={ref}
        // whitespace-pre-line keeps the line breaks typed in the admin.
        className={`whitespace-pre-line text-pretty text-base leading-relaxed text-ink/70 ${open ? "" : "line-clamp-4"}`}
      >
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1.5 text-sm font-semibold text-ember-600 underline-offset-4 hover:underline"
        >
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
