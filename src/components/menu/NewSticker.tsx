import { useTranslations } from "next-intl";

/**
 * The "New" sticker: a starburst stuck on the top-right corner of a dish card, tilted the
 * way a real sticker would be, with a light sweeping across it (`.new-sticker` in
 * globals.css — the star is a clip-path, so the sweep is cut to the same shape, and the
 * sweep stops under `prefers-reduced-motion`).
 *
 * Danish asked for this shape, and for a pale rim around it so it stands out on a photo.
 * That rim is a **second, slightly larger star behind the first**, not a border: a border
 * is painted outside the element's box and the clip-path would shear it off. Stacking two
 * stars is also what a real die-cut sticker looks like.
 *
 * It is **ember, not the pillar-box red** of the reference Danish sent: ember-600 is the
 * brand's one accent, and a second red on a card that already carries ember badges and an
 * ember price would read as a different brand's sticker.
 *
 * The word is ordinary HTML text on top of the shape, not drawn into it, so "Nieuw" and
 * "New" both fit, it is read out normally, and it never needs re-exporting as an image.
 *
 * **The caller positions it** — pass `absolute` and the offsets. The sweep is an `::after`
 * with `inset: 0`, so the sticker itself has to end up positioned.
 */
export default function NewSticker({
  className = "",
  size = "md",
}: {
  className?: string;
  /** `sm` for a card two-per-row on a phone, where the full-size one would cover the photo. */
  size?: "sm" | "md";
}) {
  const t = useTranslations("menu");
  const label = t("newItem");

  const box = size === "sm" ? "h-12 w-12 text-[0.5rem] p-[2px]" : "h-20 w-20 text-[0.72rem] p-[3px]";

  return (
    <span
      // -rotate-12 is what makes it read as stuck on rather than laid out.
      className={`sticker-star pointer-events-none flex shrink-0 -rotate-12 items-center justify-center bg-cream-50 ${box} ${className}`}
      role="img"
      aria-label={label}
    >
      <span className="new-sticker flex h-full w-full items-center justify-center bg-ember-600 text-center font-display font-bold uppercase leading-none tracking-tight text-cream-50">
        {/* z-10 keeps the word above the sweeping light. */}
        <span className="relative z-10 px-1">{label}</span>
      </span>
    </span>
  );
}
