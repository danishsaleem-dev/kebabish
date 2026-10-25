"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ArrowUpRight, Leaf, Sparkles, Snowflake, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PublicMenuItem } from "@/lib/public-menu";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import { Chili } from "@/components/menu/SpiceMeter";

type Filter = "first" | "veg" | "mild" | "spicy" | "all" | "lvl1" | "lvl2" | "lvl3";

/**
 * The mood chips, the chilli scale and the swipeable row of dishes they pick.
 *
 * - **First time here** leads with what has earned a badge (bestsellers, the chef's
 *   picks), then what the owner features, topped up with the rest so it is never thin.
 * - **Mild** = not spicy or one chilli; **spicy** = two or three chillies, plus older
 *   dishes marked "spicy" before levels existed (their level is unknown, not mild).
 * - The scale's three levels filter to exactly that level, and say how many dishes
 *   sit at it; a level with none is shown but can't be picked.
 * Orderable dishes always come first — a "price on request" dish is a poor suggestion.
 */
export default function DishFinder({ items, isOpen }: { items: PublicMenuItem[]; isOpen: boolean }) {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("first");
  const rail = useRef<HTMLDivElement>(null);

  const levelCount = (level: number) => items.filter((i) => i.spiceLevel === level).length;

  const shown = useMemo(() => {
    const orderable = (i: PublicMenuItem) => (i.soldOut ? 2 : i.price == null ? 1 : 0);
    const byOrderable = (list: PublicMenuItem[]) =>
      [...list].sort((a, b) => orderable(a) - orderable(b));
    switch (filter) {
      case "first": {
        const score = (i: PublicMenuItem) =>
          (i.bestseller ? 4 : 0) + (i.chefsPick ? 3 : 0) + (i.featured ? 2 : 0) + (i.price != null ? 1 : 0);
        return [...items]
          .filter((i) => !i.soldOut)
          .sort((a, b) => score(b) - score(a))
          .slice(0, 8);
      }
      case "veg":
        return byOrderable(items.filter((i) => i.vegetarian));
      case "mild":
        return byOrderable(items.filter((i) => i.spiceLevel === 0 || i.spiceLevel === 1));
      case "spicy":
        return byOrderable(items.filter((i) => i.spiceLevel === null || (i.spiceLevel ?? 0) >= 2));
      case "lvl1":
        return byOrderable(items.filter((i) => i.spiceLevel === 1));
      case "lvl2":
        return byOrderable(items.filter((i) => i.spiceLevel === 2));
      case "lvl3":
        return byOrderable(items.filter((i) => i.spiceLevel === 3));
      default:
        return byOrderable(items);
    }
  }, [items, filter]);

  const moods: { id: Filter; label: string; icon: React.ReactNode }[] = [
    { id: "first", label: t("home.pickFirst"), icon: <Sparkles size={15} aria-hidden="true" /> },
    { id: "veg", label: t("home.pickVeg"), icon: <Leaf size={15} aria-hidden="true" /> },
    { id: "mild", label: t("home.pickMild"), icon: <Snowflake size={15} aria-hidden="true" /> },
    { id: "spicy", label: t("home.pickSpicy"), icon: <Chili className="h-4 w-4" /> },
    { id: "all", label: t("home.pickAll"), icon: <UtensilsCrossed size={15} aria-hidden="true" /> },
  ];

  const levels = [
    { id: "lvl1" as const, level: 1, name: t("menu.spiceMild"), text: t("home.spiceMildText") },
    { id: "lvl2" as const, level: 2, name: t("menu.spiceMedium"), text: t("home.spiceMediumText") },
    { id: "lvl3" as const, level: 3, name: t("menu.spiceHot"), text: t("home.spiceHotText") },
  ];

  const scroll = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 260), behavior: "smooth" });
  };

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <div className="min-w-0">
        {/* Mood chips: one swipeable row on a phone. */}
        <div
          role="group"
          aria-label={t("home.pickTitle")}
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {moods.map((m) => {
            const active = filter === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(m.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 font-display text-sm font-semibold transition-[background-color,color,border-color,translate] duration-300 active:scale-95 ${
                  active
                    ? "border-charcoal-600 bg-charcoal-600 text-cream-50 shadow-lg shadow-charcoal-950/15"
                    : "border-charcoal-600/15 bg-cream-50 text-charcoal-600/80 hover:-translate-y-0.5 hover:border-charcoal-600/40"
                }`}
              >
                <span className={active ? "text-ember-400" : "text-ember-600"}>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-6">
          {shown.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-charcoal-600/20 bg-cream-50/60 p-8">
              <p className="text-base text-ink/70">{t("home.pickEmpty")}</p>
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-600"
              >
                {t("home.popularCta")}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div
                ref={rail}
                key={filter}
                className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-4 [scrollbar-width:none] sm:mx-0 sm:gap-4 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_88%,transparent)]"
              >
                {shown.map((item, i) => (
                  <div
                    key={item.slug}
                    className="w-[15rem] shrink-0 snap-start animate-[card-in_0.55s_var(--ease-brand)_both] motion-reduce:animate-none sm:w-[17rem]"
                    style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                  >
                    <FeaturedDishCard
                      item={item}
                      addLabel={t("menu.addToOrder")}
                      priceOnRequestLabel={t("menu.priceOnRequest")}
                      vegetarianLabel={t("menu.vegetarian")}
                      soldOutLabel={t("menu.soldOut")}
                      lowStockLabel={t("menu.lowStock")}
                      isOpen={isOpen}
                      unavailableLabel={t("status.menuUnavailable")}
                      reveal={false}
                    />
                  </div>
                ))}
                {/* Last tile: the way out to everything else. */}
                <Link
                  href="/menu"
                  className="group flex w-[12rem] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border border-charcoal-600/15 bg-cream-50 p-6 text-center font-display text-sm font-semibold text-charcoal-600 transition-colors hover:border-ember-600/40 hover:text-ember-700"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-600 text-cream-50 transition-[background-color,translate] duration-300 group-hover:translate-x-1 group-hover:bg-ember-600">
                    <ArrowRight size={18} />
                  </span>
                  {t("home.popularCta")}
                </Link>
              </div>

              {shown.length > 2 && (
                <div className="mt-2 hidden justify-end gap-2 sm:flex">
                  {[-1, 1].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => scroll(d as 1 | -1)}
                      aria-label={d === -1 ? t("home.pickPrevious") : t("home.pickNext")}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-600/20 bg-cream-50 text-charcoal-600 transition-colors hover:border-charcoal-600 hover:bg-charcoal-600 hover:text-cream-50"
                    >
                      {d === -1 ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---- the spice guide ------------------------------------------- */}
      <aside className="relative overflow-hidden rounded-3xl bg-charcoal-800 p-6 text-cream-100 shadow-xl shadow-charcoal-950/15 lg:self-start">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(169,80,38,0.40),transparent_70%)]"
        />
        <div className="relative">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ember-400">
            {t("menu.spiceScale")}
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold text-cream-50">{t("home.spiceTitle")}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-cream-200/65">{t("home.spiceText")}</p>

          {/* The heat bar: three stops, warming from left to right. */}
          <div aria-hidden="true" className="mt-5 h-1.5 rounded-full bg-linear-to-r from-cream-300 via-ember-400 to-ember-700" />

          <ul className="mt-5 space-y-2">
            {levels.map((lvl) => {
              const count = levelCount(lvl.level);
              const active = filter === lvl.id;
              return (
                <li key={lvl.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={count === 0}
                    onClick={() => setFilter(active ? "spicy" : lvl.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                      active
                        ? "bg-ember-600 text-cream-50"
                        : "bg-cream-50/[0.05] hover:bg-cream-50/10 disabled:cursor-default disabled:opacity-55 disabled:hover:bg-cream-50/[0.05]"
                    }`}
                  >
                    <span className={`inline-flex w-14 shrink-0 -space-x-1 ${active ? "text-cream-50" : "text-ember-400"}`}>
                      {[1, 2, 3].map((n) => (
                        <Chili key={n} className="h-4.5 w-4.5" lit={n <= lvl.level} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{lvl.name}</span>
                      <span className={`block text-xs ${active ? "text-cream-50/85" : "text-cream-200/55"}`}>
                        {lvl.text}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                        active ? "bg-cream-50 text-ember-700" : "bg-cream-50/10 text-cream-100/70"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
