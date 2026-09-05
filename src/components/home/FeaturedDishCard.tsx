import Image from "next/image";
import { Leaf, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatEuro } from "@/lib/money";
import type { PublicMenuItem } from "@/lib/public-menu";

/**
 * A dish card. The whole card links to the item page — that's where extras
 * get chosen and the dish is added to the cart, so there's no separate
 * "add" action here to conflict with it.
 */
export default function FeaturedDishCard({
  item,
  addLabel,
  priceOnRequestLabel,
  vegetarianLabel,
  soldOutLabel,
  isOpen,
  unavailableLabel,
  reveal = true,
}: {
  item: PublicMenuItem;
  addLabel: string;
  priceOnRequestLabel: string;
  vegetarianLabel: string;
  soldOutLabel: string;
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
  return (
    <Link
      href={`/menu/${item.slug}`}
      data-reveal={reveal ? "" : undefined}
      className="group flex flex-col overflow-hidden rounded-3xl border border-cream-400/40 bg-cream-50 shadow-sm shadow-charcoal-950/5 transition-[transform,box-shadow] duration-500 ease-brand hover:-translate-y-1.5 hover:shadow-xl hover:shadow-charcoal-950/10"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-cream-300">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
          />
        ) : (
          // No photo for this dish yet. A branded tile reads as intentional,
          // where an empty grey box reads as broken.
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-cream-300),var(--color-cream-200))]"
          >
            <Image
              src="/logo/Kebabish-light.png"
              alt=""
              width={220}
              height={165}
              className="h-auto w-20 opacity-25 transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
            />
          </div>
        )}

        {item.vegetarian && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-cream-50/95 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-green-800 backdrop-blur-sm"
            title={vegetarianLabel}
          >
            <Leaf size={12} />
            {vegetarianLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-charcoal-600">
          {item.name}
        </h3>

        {item.variants.length > 0 && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink/55">
            {item.variants.join(" · ")}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="font-display text-sm font-semibold text-charcoal-500">
            {item.price != null ? formatEuro(item.price) : priceOnRequestLabel}
          </span>

          {item.soldOut ? (
            <Pill muted>{soldOutLabel}</Pill>
          ) : isOpen ? (
            <Pill>
              <Plus size={14} />
              {addLabel}
            </Pill>
          ) : (
            <Pill muted>{unavailableLabel}</Pill>
          )}
        </div>
      </div>
    </Link>
  );
}

function Pill({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors duration-300 ${
        muted
          ? "bg-charcoal-600/10 text-charcoal-500"
          : "bg-charcoal-600 text-cream-100 group-hover:bg-ember-600"
      }`}
    >
      {children}
    </span>
  );
}
