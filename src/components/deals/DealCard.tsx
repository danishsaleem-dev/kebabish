import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatEuro } from "@/lib/money";
import type { PublicDeal } from "@/lib/public-deals";
import BrandLogo from "@/components/shared/BrandLogo";

export interface DealCardLabels {
  save: string;
  was: string;
  view: string;
  soldOut: string;
}

/** The deal's photo, or the photos of what's inside it side by side. */
export function DealPhoto({ deal, sizes, priority = false }: { deal: PublicDeal; sizes: string; priority?: boolean }) {
  const photos = deal.images.slice(0, 3);
  if (photos.length === 0) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-charcoal-700">
        <BrandLogo src="/logo/kebabish-dark.png" alt="" width={200} height={150} className="h-auto w-24 opacity-50" />
      </span>
    );
  }
  return (
    <span className="flex h-full w-full gap-0.5">
      {photos.map((src, i) => (
        <span key={src} className="relative h-full min-w-0 flex-1 overflow-hidden">
          <Image
            src={src}
            alt={i === 0 ? deal.name : ""}
            fill
            sizes={sizes}
            priority={priority && i === 0}
            className="object-cover transition-transform duration-700 ease-brand group-hover:scale-105"
          />
        </span>
      ))}
    </span>
  );
}

/**
 * A deal, sold big: photo edge to edge, the saving as a stamp on it, the crossed-out price beside the
 * real one. `lead` is the wide version for the first deal in a section. The whole card opens the deal
 * through a stretched link on the title.
 */
export default function DealCard({
  deal,
  labels,
  lead = false,
  heading: Heading = "h3",
}: {
  deal: PublicDeal;
  labels: DealCardLabels;
  lead?: boolean;
  /** h2 where the card sits straight under the page's h1. */
  heading?: "h2" | "h3";
}) {
  const contents = deal.slots
    .map((s) => {
      const name = s.label || s.choices[0]?.name || "";
      return s.quantity > 1 && !s.label ? `${s.quantity} × ${name}` : name;
    })
    .filter(Boolean);

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-cream-50 shadow-[0_18px_44px_-20px_rgba(20,18,15,0.55)] ring-1 ring-charcoal-600/10 transition-[translate,box-shadow] duration-500 ease-brand has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ember-500 hover:-translate-y-1.5 ${
        lead ? "lg:flex-row" : ""
      }`}
    >
      <div className={`relative shrink-0 bg-charcoal-700 ${lead ? "aspect-[16/10] lg:aspect-auto lg:w-3/5" : "aspect-[16/10]"}`}>
        <DealPhoto
          deal={deal}
          sizes={lead ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 26vw, 85vw"}
          priority={lead}
        />
        {deal.saving > 0 && (
          <span className="absolute left-3 top-3 -rotate-3 rounded-2xl bg-ember-600 px-3.5 py-2 font-display text-base font-bold text-cream-50 shadow-lg shadow-ember-800/40 sm:text-lg">
            {labels.save.replace("{amount}", formatEuro(deal.saving))}
          </span>
        )}
        {deal.soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-charcoal-950/75 px-4 py-2 text-center text-sm font-semibold text-cream-50">
            {labels.soldOut}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <Heading className={`font-display font-semibold leading-tight text-charcoal-600 ${lead ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
          <Link
            href={`/deals/${deal.slug}`}
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {deal.name}
          </Link>
        </Heading>

        <ul className="mt-3 space-y-1 text-sm text-ink/70">
          {contents.slice(0, lead ? 6 : 4).map((text, i) => (
            <li key={`${text}-${i}`} className="flex gap-2">
              <span aria-hidden="true" className="text-ember-600">+</span>
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="min-w-0">
            {deal.saving > 0 && (
              <span className="block text-sm text-ink/55">
                {labels.was} <s className="tabular-nums">{formatEuro(deal.wasPrice)}</s>
              </span>
            )}
            <span className={`block font-display font-bold tabular-nums text-ember-700 ${lead ? "text-4xl" : "text-3xl"}`}>
              {formatEuro(deal.price)}
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-charcoal-600 px-4 py-2.5 font-display text-sm font-semibold text-cream-50 transition-colors group-hover:bg-ember-600">
            {labels.view}
            <ArrowRight size={15} aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}
