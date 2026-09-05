"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X, Leaf, Flame, EyeOff } from "lucide-react";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/public-menu";

type Toggle = "vegetarian" | "spicy" | "hideSoldOut";

/**
 * The full menu with client-side filtering. Everything renders unfiltered
 * on the server first, so a crawler still sees every dish (SEO is priority
 * #1) — the filters only ever narrow what's already in the HTML.
 *
 * Categories arrive with their labels already resolved by the server,
 * since the six original ones are translated while any category Danish
 * adds in /admin has only the label he typed.
 */
export default function MenuBrowser({
  categories,
  isOpen,
}: {
  categories: PublicMenuCategory[];
  isOpen: boolean;
}) {
  const t = useTranslations("menu");
  const tStatus = useTranslations("status");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [toggles, setToggles] = useState<Record<Toggle, boolean>>({
    vegetarian: false,
    spicy: false,
    hideSoldOut: false,
  });

  const toggle = (key: Toggle) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return categories
      .filter((c) => category === "all" || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items.filter((item) => {
          if (q && !matches(item, q)) return false;
          if (toggles.vegetarian && !item.vegetarian) return false;
          if (toggles.spicy && !item.spicy) return false;
          if (toggles.hideSoldOut && item.soldOut) return false;
          return true;
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, category, toggles]);

  const count = filtered.reduce((sum, c) => sum + c.items.length, 0);
  const isFiltered =
    query.trim() !== "" ||
    category !== "all" ||
    toggles.vegetarian ||
    toggles.spicy ||
    toggles.hideSoldOut;

  const clear = () => {
    setQuery("");
    setCategory("all");
    setToggles({ vegetarian: false, spicy: false, hideSoldOut: false });
  };

  return (
    <div>
      {/* ---- filters ---------------------------------------------------- */}
      <div className="mt-10 space-y-4">
        <label className="relative block">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-full border border-charcoal-600/15 bg-cream-50 pl-11 pr-4 text-base text-ink placeholder:text-ink/40 focus:border-ember-600 focus:outline-none"
          />
        </label>

        {/* Horizontally scrollable on mobile so the chips never wrap into a
            tall stack that pushes the dishes off screen. */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            {t("allCategories")}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip
            active={toggles.vegetarian}
            onClick={() => toggle("vegetarian")}
            accent
          >
            <Leaf size={14} aria-hidden="true" />
            {t("vegetarian")}
          </Chip>
          <Chip active={toggles.spicy} onClick={() => toggle("spicy")} accent>
            <Flame size={14} aria-hidden="true" />
            {t("spicy")}
          </Chip>
          <Chip
            active={toggles.hideSoldOut}
            onClick={() => toggle("hideSoldOut")}
            accent
          >
            <EyeOff size={14} aria-hidden="true" />
            {t("hideSoldOut")}
          </Chip>
        </div>

        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 text-sm text-ink/60"
        >
          <span>{t("resultCount", { count })}</span>
          {isFiltered && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 font-semibold text-ember-600 hover:text-ember-500"
            >
              <X size={14} aria-hidden="true" />
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* ---- results ---------------------------------------------------- */}
      {count === 0 ? (
        <p className="mt-16 text-center text-base text-ink/60">
          {t("noResults")}
        </p>
      ) : (
        <div className="mt-10 space-y-16">
          {filtered.map((c) => (
            <section key={c.id} id={c.id}>
              <h2 className="font-display text-2xl font-semibold text-charcoal-600">
                {c.label}
              </h2>
              {c.description && (
                <p className="mt-1.5 text-sm text-ink/55">{c.description}</p>
              )}
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {c.items.map((item) => (
                  <FeaturedDishCard
                    key={item.slug}
                    item={item}
                    addLabel={t("addToOrder")}
                    priceOnRequestLabel={t("priceOnRequest")}
                    vegetarianLabel={t("vegetarian")}
                    soldOutLabel={t("soldOut")}
                    isOpen={isOpen}
                    unavailableLabel={tStatus("menuUnavailable")}
                    reveal={false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function matches(item: PublicMenuItem, q: string) {
  if (item.name.toLowerCase().includes(q)) return true;
  return item.variants.some((v) => v.toLowerCase().includes(q));
}

function Chip({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClasses = accent
    ? "border-ember-600 bg-ember-600 text-cream-50"
    : "border-charcoal-600 bg-charcoal-600 text-cream-100";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 font-display text-sm font-semibold transition-colors duration-300 ${
        active
          ? activeClasses
          : "border-charcoal-600/20 text-charcoal-600/75 hover:border-charcoal-600/45 hover:text-charcoal-600"
      }`}
    >
      {children}
    </button>
  );
}
