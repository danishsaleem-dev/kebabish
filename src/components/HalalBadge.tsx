import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * The "100% halal" seal, fixed to the bottom-left corner of every public page
 * (it is mounted once in `[locale]/layout.tsx`, so it also appears on the
 * coming-soon page and the 404, but never in the admin, kitchen or rider apps,
 * which sit outside `[locale]`).
 *
 * - **Purely decorative to the pointer** (`pointer-events-none`): it sits over page
 *   content in a corner, and on a phone that corner can hold a form field or a
 *   button — it must never swallow a tap meant for what is underneath.
 * - **Bottom-right belongs to the WhatsApp button**, so the two never collide.
 * - **Hidden when printing**, so a receipt or invoice page doesn't get a stamp on it.
 * - `next/image` resizes it: the source is a 1254px PNG (~800 KB) and this is shown
 *   at 64–96px, so the browser is sent a small WebP instead.
 */
export default function HalalBadge() {
  const t = useTranslations("common");

  return (
    <div className="pointer-events-none fixed bottom-[calc(var(--dock,0px)+0.75rem)] left-3 z-40 select-none print:hidden sm:bottom-[calc(var(--dock,0px)+1.25rem)] sm:left-5">
      <Image
        src="/halal.png"
        alt={t("halalBadge")}
        width={96}
        height={96}
        sizes="(min-width: 640px) 96px, 64px"
        // Always on screen from the first paint, so it loads eagerly instead of popping in late.
        loading="eager"
        className="h-16 w-16 drop-shadow-[0_4px_10px_rgba(20,18,15,0.35)] sm:h-24 sm:w-24"
      />
    </div>
  );
}
