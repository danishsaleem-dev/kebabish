import Image from "next/image";
import { ArrowUpRight, Leaf } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatEuro } from "@/lib/money";
import type { PublicMenuItem } from "@/lib/public-menu";
import BrandLogo from "@/components/shared/BrandLogo";
import DishBadges from "@/components/menu/DishBadges";
import SpiceMeter from "@/components/menu/SpiceMeter";
import QuickAdd from "@/components/menu/QuickAdd";

/**
 * A dish card, in the style of a modern delivery app:
 *
 * - **The photo is inset** in the card with its own rounded corners, and carries the
 *   price as a frosted chip, the badges (Bestseller / Chef's pick) and the vegetarian
 *   leaf. It zooms gently on hover while the card lifts and picks up an ember rim.
 * - **The round action button sits on the seam** between photo and text. For a dish
 *   with no required choice it is a real one-tap add (`QuickAdd`, which then shows how
 *   many are in the basket); for one with a required sauce or size it is an arrow that
 *   is part of the card and opens the dish page, where the choice is made.
 * - **Sold out** greys the photo and says so across it — the dish stays visible and its
 *   page still offers the "request it" form. **Closed** hides the button and says why.
 * - Under the name: the chillies, the portion, "selling fast" (never a number), and —
 *   on a wide card — the first lines of the dish's own description.
 *
 * The whole card opens the dish page through a stretched link on the title (its
 * `::after` covers the card); the add button sits above that link at `z-10`.
 *
 * It sizes itself by **container** query, not viewport: the same card is two per row
 * on a phone's menu grid (~160px wide) and wide on the homepage, and a media query
 * can't tell those apart. Below 16rem of its own width it tightens everything and
 * drops the description.
 */
export default function FeaturedDishCard({
  item,
  addLabel,
  priceOnRequestLabel,
  vegetarianLabel,
  soldOutLabel,
  lowStockLabel,
  isOpen,
  unavailableLabel,
  reveal = true,
}: {
  item: PublicMenuItem;
  addLabel: string;
  priceOnRequestLabel: string;
  vegetarianLabel: string;
  soldOutLabel: string;
  /** "Selling fast" — shown on a dish that is nearly gone (never a number). */
  lowStockLabel?: string;
  isOpen: boolean;
  unavailableLabel: string;
  /**
   * Scroll-reveal is primed to opacity:0 by CSS and only ever un-hidden by
   * the GSAP `Motion` island, which mounts on the homepage alone. Anywhere
   * without it — the filterable menu grid, where cards also mount and
   * unmount as filters change — must opt out or the cards stay invisible.
   */
  reveal?: boolean;
}) {
  const orderable = isOpen && !item.soldOut && item.price != null;
  const canQuickAdd = orderable && item.quickAdd;

  return (
    <div className="@container h-full">
      <article
        data-reveal={reveal ? "" : undefined}
        className="group relative flex h-full flex-col rounded-[1.4rem] bg-cream-50 p-1.5 shadow-[0_1px_2px_rgba(20,18,15,0.04),0_8px_24px_-12px_rgba(20,18,15,0.18)] ring-1 ring-charcoal-600/8 transition-[translate,box-shadow] duration-500 ease-brand has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ember-500 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(20,18,15,0.05),0_28px_50px_-18px_rgba(140,64,29,0.35)] hover:ring-ember-500/30 @min-[16rem]:rounded-[1.75rem] @min-[16rem]:p-2"
      >
        {/* ---- photo (inset) ------------------------------------------- */}
        <div className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[1.1rem] bg-cream-300 @min-[16rem]:rounded-[1.35rem]">
            {item.image ? (
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 47vw"
                className={`object-cover transition-transform duration-[900ms] ease-brand group-hover:scale-[1.07] ${
                  item.soldOut ? "grayscale-[0.85]" : ""
                }`}
              />
            ) : (
              // No photo for this dish yet. A branded tile reads as intentional,
              // where an empty grey box reads as broken.
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-[radial-gradient(80%_70%_at_50%_30%,var(--color-cream-200),var(--color-cream-400))]"
              >
                <BrandLogo
                  src="/logo/Kebabish-light.png"
                  alt=""
                  width={220}
                  height={165}
                  className="h-auto w-20 opacity-30 transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
                />
              </div>
            )}

            {/* Soft shade top and bottom, so the chips read on any photo. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(20,18,15,0.28),transparent_32%,transparent_62%,rgba(20,18,15,0.38))]"
            />

            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1.5 @min-[16rem]:inset-x-3 @min-[16rem]:top-3">
              <DishBadges
                chefsPick={item.chefsPick}
                bestseller={item.bestseller}
                className="@max-[16rem]:hidden"
              />
              <DishBadges
                chefsPick={item.chefsPick}
                bestseller={item.bestseller}
                compact
                className="@min-[16rem]:hidden"
              />
              {item.vegetarian && (
                <span
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream-50/95 text-green-800 shadow-sm backdrop-blur-sm @min-[16rem]:h-8 @min-[16rem]:w-8"
                  title={vegetarianLabel}
                  aria-label={vegetarianLabel}
                  role="img"
                >
                  <Leaf size={14} aria-hidden="true" />
                </span>
              )}
            </div>

            {/* The price, frosted, bottom-left of the photo. */}
            <span className="absolute bottom-2 left-2 rounded-full bg-cream-50/92 px-2.5 py-1 font-display text-[0.8rem] font-bold tabular-nums text-charcoal-700 shadow-sm backdrop-blur-md @min-[16rem]:bottom-3 @min-[16rem]:left-3 @min-[16rem]:px-3.5 @min-[16rem]:py-1.5 @min-[16rem]:text-base">
              {item.price != null ? formatEuro(item.price) : priceOnRequestLabel}
            </span>

            {item.soldOut && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="-rotate-6 rounded-full bg-charcoal-800/90 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-[0.14em] text-cream-50 shadow-lg backdrop-blur-sm">
                  {soldOutLabel}
                </span>
              </span>
            )}
          </div>

          {/* ---- the round action on the seam --------------------------- */}
          {orderable && (
            <div className="absolute -bottom-5 right-2.5 @min-[16rem]:-bottom-6 @min-[16rem]:right-4">
              {canQuickAdd ? (
                <QuickAdd slug={item.slug} name={item.name} price={item.price as number} image={item.image} />
              ) : (
                // Needs a choice first: part of the card's link, so it opens the dish.
                <span
                  aria-hidden="true"
                  title={addLabel}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-50 text-charcoal-700 shadow-lg shadow-charcoal-950/20 ring-4 ring-cream-50 transition-[background-color,color,transform] duration-300 ease-brand group-hover:rotate-45 group-hover:bg-ember-600 group-hover:text-cream-50 @min-[16rem]:h-12 @min-[16rem]:w-12"
                >
                  <ArrowUpRight size={20} strokeWidth={2.5} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* ---- text --------------------------------------------------- */}
        <div className="flex flex-1 flex-col px-1.5 pb-2 pt-3 @min-[16rem]:px-3 @min-[16rem]:pb-3 @min-[16rem]:pt-4">
          <h3 className="pr-11 font-display text-[0.92rem] font-semibold leading-snug text-charcoal-600 transition-colors duration-300 group-hover:text-ember-700 @min-[16rem]:pr-14 @min-[16rem]:text-lg">
            <Link
              href={`/menu/${item.slug}`}
              className="after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none"
            >
              {item.name}
            </Link>
          </h3>

          {(item.spiceLevel !== 0 || item.portion || (item.lowStock && lowStockLabel)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.7rem] text-ink/55 @min-[16rem]:text-xs">
              <SpiceMeter level={item.spiceLevel} size="xs" />
              {item.portion && <span>{item.portion}</span>}
              {item.lowStock && lowStockLabel && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ember-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-ember-500/60 motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-ember-600" />
                  </span>
                  {lowStockLabel}
                </span>
              )}
            </div>
          )}

          {(item.description || item.variants.length > 0) && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink/55 @max-[16rem]:hidden">
              {item.description || item.variants.join(" · ")}
            </p>
          )}

          {!item.soldOut && !isOpen && (
            <p className="mt-auto pt-3 text-[0.7rem] font-semibold text-charcoal-500/80 @min-[16rem]:text-xs">
              {unavailableLabel}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
