import Image from "next/image";
import { Leaf, Plus } from "lucide-react";
import type { MenuItem } from "@/lib/menu-data";

export default function FeaturedDishCard({
  item,
  image,
  orderHref,
  addLabel,
  priceOnRequestLabel,
  vegetarianLabel,
  isOpen,
  unavailableLabel,
}: {
  item: MenuItem;
  image: string;
  orderHref: string;
  addLabel: string;
  priceOnRequestLabel: string;
  vegetarianLabel: string;
  isOpen: boolean;
  unavailableLabel: string;
}) {
  return (
    <article
      data-reveal
      className="group flex flex-col overflow-hidden rounded-3xl border border-cream-400/40 bg-cream-50 shadow-sm shadow-charcoal-950/5 transition-[transform,box-shadow] duration-500 ease-brand hover:-translate-y-1.5 hover:shadow-xl hover:shadow-charcoal-950/10"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-cream-300">
        <Image
          src={image}
          alt={item.name}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
        />

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

        {item.variants && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink/55">
            {item.variants.join(" · ")}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="font-display text-sm font-semibold text-charcoal-500">
            {item.price != null
              ? `€ ${item.price.toFixed(2)}`
              : priceOnRequestLabel}
          </span>

          {!item.soldOut &&
            (isOpen ? (
              <a
                href={orderHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-charcoal-600 px-4 py-2.5 text-xs font-semibold text-cream-100 transition-colors duration-300 hover:bg-ember-600"
              >
                <Plus size={14} />
                {addLabel}
              </a>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-charcoal-600/10 px-4 py-2.5 text-xs font-semibold text-charcoal-500">
                {unavailableLabel}
              </span>
            ))}
        </div>
      </div>
    </article>
  );
}
