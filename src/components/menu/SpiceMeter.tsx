import { useTranslations } from "next-intl";

/**
 * How hot a dish is, as chillies: one (mild), two (medium) or three (hot), with the
 * unlit ones dimmed so the scale reads at a glance. `null` is an older dish marked
 * "spicy" before levels existed — it gets one chilli and the plain word "spicy",
 * because claiming a level the owner never picked would be inventing it.
 *
 * Plain (non-async) component, so it renders on the server and in client components
 * alike. lucide has no chilli, hence the inline glyph.
 */

export function Chili({ className = "", lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} ${lit ? "" : "opacity-25"}`}
      fill="currentColor"
    >
      {/* stem */}
      <path
        d="M15.6 3.2c.3-.9 1.2-1.5 2.2-1.4.4 0 .6.4.4.7-.4.6-.6 1.2-.6 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* pod */}
      <path d="M17.9 5.1c1.9 1.1 2.6 3.5 1.6 5.6-2.2 4.6-7.6 9.8-14.4 11.2-1 .2-1.6-1-.9-1.7 3.4-3.3 5.6-7.2 7-11.6.8-2.6 3.3-4.6 6-3.9.2.1.5.2.7.4Z" />
    </svg>
  );
}

export default function SpiceMeter({
  level,
  size = "sm",
  showLabel = true,
  tone = "light",
  className = "",
}: {
  /** 0 not spicy (renders nothing), 1–3, or null for "spicy, level unknown". */
  level: number | null;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  /** "light" = on a cream background; "dark" = on charcoal. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("menu");
  if (level === 0) return null;

  const label =
    level === 1
      ? t("spiceMild")
      : level === 2
        ? t("spiceMedium")
        : level === 3
          ? t("spiceHot")
          : t("spicy");
  const icon = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const count = level ?? 1;
  const slots = level === null ? 1 : 3;

  return (
    <span
      className={`inline-flex items-center gap-1 ${tone === "dark" ? "text-ember-400" : "text-ember-600"} ${className}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <span className="inline-flex -space-x-0.5">
        {Array.from({ length: slots }, (_, i) => (
          <Chili key={i} className={icon} lit={i < count} />
        ))}
      </span>
      {showLabel && (
        <span
          aria-hidden="true"
          className={`font-semibold ${size === "md" ? "text-sm" : "text-[0.7rem]"} ${
            tone === "dark" ? "text-cream-100/80" : "text-charcoal-600/80"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
