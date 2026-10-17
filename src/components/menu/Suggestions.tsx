"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { formatEuro } from "@/lib/money";
import BrandLogo from "@/components/shared/BrandLogo";
import type { SuggestionCard } from "@/lib/suggestions";

/**
 * "Often bought with" — small dish cards to add next to what someone is ordering.
 * The same strip appears in four places, which is why it lives here once:
 *  - under the add button on a dish's page, once something has been added (`cards`);
 *  - in the basket drawer (`scroll`, one swipeable row);
 *  - at checkout beside the order summary (`rows`);
 *  - in the "not available right now" popup, as alternatives (`cards`).
 *
 * What is suggested comes from `/api/suggestions` (the owner's picks first, then what
 * was really bought together, then what sells — see lib/suggestions.ts). Anything
 * already in the basket is left out when the strip loads; it is *not* refetched as
 * the basket changes, so a card doesn't vanish under someone's thumb the moment they
 * tap it — it flips to "Added" and stays. A dish with a required choice (a sauce, a
 * size) can't be added in one tap, so its card links to the dish's page instead.
 * Renders nothing while loading or when there is nothing to suggest.
 */

type Variant = "cards" | "scroll" | "rows";

export default function Suggestions({
  basedOn,
  variant = "cards",
  limit = 4,
  title,
  className = "",
}: {
  /** The dish being looked at, or every dish in the basket. */
  basedOn: string[];
  variant?: Variant;
  limit?: number;
  title?: string;
  className?: string;
}) {
  const t = useTranslations("suggestions");
  const locale = useLocale();
  const { lines, add } = useCart();
  const [items, setItems] = useState<SuggestionCard[] | null>(null);

  // The basket as it is when the fetch starts, without re-running the fetch on every change.
  const basketRef = useRef<string[]>([]);
  useEffect(() => {
    basketRef.current = lines.map((l) => l.slug);
  }, [lines]);

  // Fixed when the strip appears: the basket changing under it (including because
  // someone just tapped one of its own cards) must not reshuffle what they are looking at.
  const [key] = useState(() => basedOn.join(","));
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      slugs: key,
      exclude: [...new Set(basketRef.current)].join(","),
      locale,
      limit: String(limit),
    });
    fetch(`/api/suggestions?${params}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: SuggestionCard[] }) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [key, locale, limit]);

  if (!items || items.length === 0) return null;

  const countInBasket = (slug: string) =>
    lines.filter((l) => l.slug === slug).reduce((n, l) => n + l.quantity, 0);

  const quickAdd = (card: SuggestionCard) =>
    add({
      slug: card.slug,
      name: card.name,
      image: card.image,
      unitPrice: card.price,
      options: [],
      instructions: "",
    });

  const heading = title ?? t("title");

  return (
    <section aria-label={heading} className={className}>
      <h2 className="font-display text-lg font-semibold text-charcoal-600 sm:text-xl">{heading}</h2>

      <ul
        className={
          variant === "cards"
            ? "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
            : variant === "scroll"
              ? "mt-3 -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
              : "mt-3 space-y-2.5"
        }
      >
        {items.map((card) => {
          const inBasket = countInBasket(card.slug);
          return (
            <li
              key={card.slug}
              className={
                variant === "scroll"
                  ? "w-36 shrink-0 snap-start"
                  : variant === "rows"
                    ? ""
                    : "min-w-0"
              }
            >
              {variant === "rows" ? (
                <Row card={card} inBasket={inBasket} onAdd={() => quickAdd(card)} t={t} />
              ) : (
                <Tile card={card} inBasket={inBasket} onAdd={() => quickAdd(card)} t={t} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type T = (key: string, values?: Record<string, string | number>) => string;

function Thumb({ card, className }: { card: SuggestionCard; className: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-cream-300 ${className}`}>
      {card.image ? (
        <Image src={card.image} alt="" fill sizes="160px" className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-cream-300),var(--color-cream-200))]">
          <BrandLogo src="/logo/Kebabish-light.png" alt="" width={120} height={90} className="h-auto w-8 opacity-30" />
        </span>
      )}
    </span>
  );
}

function AddControl({
  card,
  inBasket,
  onAdd,
  t,
  compact,
}: {
  card: SuggestionCard;
  inBasket: number;
  onAdd: () => void;
  t: T;
  compact?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1 rounded-full text-xs font-semibold transition-colors";

  if (card.needsChoice) {
    return (
      <Link
        href={`/menu/${card.slug}`}
        className={`${base} ${compact ? "h-9 w-9" : "px-3.5 py-2"} bg-charcoal-600/10 text-charcoal-600 hover:bg-charcoal-600 hover:text-cream-50`}
        aria-label={`${t("choose")} — ${card.name}`}
      >
        {compact ? <Plus size={16} /> : t("choose")}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={t("addAria", { name: card.name })}
      className={`${base} ${compact ? "h-9 min-w-9 px-2" : "px-3.5 py-2"} ${
        inBasket > 0
          ? "bg-success-soft text-success hover:bg-success hover:text-white"
          : "bg-charcoal-600 text-cream-100 hover:bg-ember-600"
      }`}
    >
      {inBasket > 0 ? <Check size={14} /> : <Plus size={14} />}
      {!compact && (inBasket > 0 ? `${t("added")} · ${inBasket}` : t("add"))}
      {compact && inBasket > 0 && <span className="tabular-nums">{inBasket}</span>}
    </button>
  );
}

/** A small vertical card: photo, name, price, one button. */
function Tile({ card, inBasket, onAdd, t }: { card: SuggestionCard; inBasket: number; onAdd: () => void; t: T }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-cream-400/40 bg-cream-50 shadow-sm shadow-charcoal-950/5">
      <Link href={`/menu/${card.slug}`} className="block">
        <Thumb card={card} className="aspect-4/3 w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          href={`/menu/${card.slug}`}
          className="line-clamp-2 font-display text-sm font-semibold leading-snug text-charcoal-600 hover:text-ember-600"
        >
          {card.name}
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-display text-sm font-semibold text-charcoal-500">{formatEuro(card.price)}</span>
          <AddControl card={card} inBasket={inBasket} onAdd={onAdd} t={t} compact />
        </div>
      </div>
    </div>
  );
}

/** A compact horizontal row, for the checkout summary. */
function Row({ card, inBasket, onAdd, t }: { card: SuggestionCard; inBasket: number; onAdd: () => void; t: T }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cream-400/40 bg-cream-100/60 p-2">
      <Thumb card={card} className="h-12 w-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/menu/${card.slug}`}
          target="_blank"
          className="block truncate text-sm font-semibold text-charcoal-600 hover:text-ember-600"
        >
          {card.name}
        </Link>
        <span className="text-xs text-ink/60">{formatEuro(card.price)}</span>
      </div>
      <AddControl card={card} inBasket={inBasket} onAdd={onAdd} t={t} compact />
    </div>
  );
}
