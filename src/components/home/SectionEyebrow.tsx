import type { ReactNode } from "react";

/**
 * The small ember-ruled label that opens every section. Kept in one place so
 * the rhythm stays identical across the page.
 */
export default function SectionEyebrow({
  children,
  tone = "dark",
  className = "",
}: {
  children: ReactNode;
  /** "light" = sitting on a charcoal background. */
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <p
      data-reveal
      className={`inline-flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] ${
        tone === "light" ? "text-ember-400" : "text-ember-600"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-8 ${tone === "light" ? "bg-ember-400/60" : "bg-ember-600/50"}`}
      />
      {children}
    </p>
  );
}
