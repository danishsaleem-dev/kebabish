"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, Flame, Leaf, Search, SlidersHorizontal, X } from "lucide-react";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/public-menu";
import SpiceMeter, { Chili } from "@/components/menu/SpiceMeter";
import ReorderCard from "@/components/reorder/ReorderCard";

type Toggle = "vegetarian" | "spicy" | "hideSoldOut";

/**
 * The full menu, laid out the way delivery apps have taught everyone to read one:
 *
 * - **A sticky toolbar** under the site header: search, the filters, and a row of
 *   category tabs. The tabs follow the scroll (the section you are reading is lit, and
 *   the tab row slides it into view) and tapping one jumps to that section — browsing
 *   the whole menu stays one continuous scroll instead of a filter that hides the rest.
 * - **"Popular now"** leads (the most-ordered dishes, `getPopularItems`), and steps
 *   aside while someone is searching or filtering.
 * - **Every section** is a heading with its count and description over a grid: two
 *   cards per row on a phone, three from `lg`, four from `xl`.
 *
 * Everything renders unfiltered on the server first, so a crawler sees every dish
 * (SEO is priority #1) — search and filters only narrow what is already in the HTML.
 * The toolbar's sticky offset follows the real header height (the open/closed banner
 * lives inside the header and changes it), measured into `--menu-top`.
 */
export default function MenuBrowser({
  categories,
  popular,
  isOpen,
}: {
  categories: PublicMenuCategory[];
  popular: PublicMenuItem[];
  isOpen: boolean;
}) {
  const t = useTranslations("menu");
  const tStatus = useTranslations("status");

  const [query, setQuery] = useState("");
  const [toggles, setToggles] = useState<Record<Toggle, boolean>>({
    vegetarian: false,
    spicy: false,
    hideSoldOut: false,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [active, setActive] = useState<string>(categories[0]?.id ?? "");
  const tabRow = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);

  const toggle = (key: Toggle) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const q = query.trim().toLowerCase();
  const filtering = q !== "" || Object.values(toggles).some(Boolean);

  const passes = useMemo(
    () => (item: PublicMenuItem) => {
      if (q && !matches(item, q)) return false;
      if (toggles.vegetarian && !item.vegetarian) return false;
      if (toggles.spicy && !item.spicy) return false;
      if (toggles.hideSoldOut && item.soldOut) return false;
      return true;
    },
    [q, toggles]
  );

  const filtered = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: c.items.filter(passes) }))
        .filter((c) => c.items.length > 0),
    [categories, passes]
  );
  const count = filtered.reduce((sum, c) => sum + c.items.length, 0);

  const clear = () => {
    setQuery("");
    setToggles({ vegetarian: false, spicy: false, hideSoldOut: false });
  };

  // The header's real height (the status banner lives inside it), so the toolbar sticks
  // right under it and section jumps land below both.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const set = () =>
      document.documentElement.style.setProperty("--menu-top", `${header.getBoundingClientRect().height}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--menu-top");
    };
  }, []);

  // Scroll-spy: the section nearest the top (just under the toolbar) is "active".
  useEffect(() => {
    const sections = filtered
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;
    const onScroll = () => {
      const line = (toolbar.current?.getBoundingClientRect().bottom ?? 120) + 24;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top - line <= 0) current = section.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [filtered]);

  // Keep the lit tab in view inside the (horizontally scrolling) tab row.
  useEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!row || !tab) return;
    const left = tab.offsetLeft - row.clientWidth / 2 + tab.clientWidth / 2;
    row.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = (toolbar.current?.getBoundingClientRect().bottom ?? 120) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
    setActive(id);
  };

  const toggleOptions: { key: Toggle; label: string; icon: React.ReactNode }[] = [
    { key: "vegetarian", label: t("vegetarian"), icon: <Leaf size={15} aria-hidden="true" /> },
    { key: "spicy", label: t("spicy"), icon: <Chili className="h-4 w-4" /> },
    { key: "hideSoldOut", label: t("hideSoldOut"), icon: <EyeOff size={15} aria-hidden="true" /> },
  ];
  const activeToggles = Object.values(toggles).filter(Boolean).length;

  const card = (item: PublicMenuItem) => (
    <FeaturedDishCard
      key={item.slug}
      item={item}
      addLabel={t("addToOrder")}
      priceOnRequestLabel={t("priceOnRequest")}
      vegetarianLabel={t("vegetarian")}
      soldOutLabel={t("soldOut")}
      lowStockLabel={t("lowStock")}
      isOpen={isOpen}
      unavailableLabel={tStatus("menuUnavailable")}
      reveal={false}
    />
  );

  return (
    <div className="mt-8">
      {/* ---- the sticky toolbar ------------------------------------------ */}
      <div
        ref={toolbar}
        className="sticky top-[var(--menu-top,4rem)] z-30 -mx-5 border-b border-charcoal-600/10 bg-cream-200/92 px-5 pb-2 pt-3 backdrop-blur-lg sm:-mx-6 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
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
              className="h-12 w-full rounded-full border border-charcoal-600/12 bg-cream-50 pl-11 pr-10 text-base text-ink shadow-sm shadow-charcoal-950/5 placeholder:text-ink/40 focus:border-ember-600 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("clearSearch")}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/50 hover:bg-cream-200"
              >
                <X size={16} />
              </button>
            )}
          </label>

          {/* Filters: inline chips from md, one button + panel below that. */}
          <div className="hidden items-center gap-2 md:flex">
            {toggleOptions.map(({ key, label, icon }) => (
              <FilterChip key={key} active={toggles[key]} onClick={() => toggle(key)}>
                {icon}
                {label}
              </FilterChip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="menu-filter-panel"
            aria-label={t("filtersLabel")}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors md:hidden ${
              filtersOpen || activeToggles > 0
                ? "border-ember-600 bg-ember-600 text-cream-50"
                : "border-charcoal-600/12 bg-cream-50 text-charcoal-600/80"
            }`}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {activeToggles > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-charcoal-700 px-1 text-[0.65rem] font-bold text-cream-50 ring-2 ring-cream-200">
                {activeToggles}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div id="menu-filter-panel" className="mt-3 rounded-2xl border border-charcoal-600/10 bg-cream-50 p-4 md:hidden">
            <div className="flex flex-wrap gap-2">
              {toggleOptions.map(({ key, label, icon }) => (
                <FilterChip key={key} active={toggles[key]} onClick={() => toggle(key)}>
                  {icon}
                  {label}
                </FilterChip>
              ))}
            </div>
            <SpiceLegend className="mt-4 border-t border-charcoal-600/8 pt-4" />
          </div>
        )}

        {/* Category tabs — follow the scroll, tap to jump. */}
        <nav aria-label={t("categoryLabel")} className="mt-3">
          <div
            ref={tabRow}
            className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6"
          >
            {filtered.map((c) => {
              const lit = active === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-tab={c.id}
                  onClick={() => jumpTo(c.id)}
                  aria-current={lit ? "true" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-display text-sm font-semibold transition-[background-color,color] duration-300 ${
                    lit
                      ? "bg-charcoal-700 text-cream-50 shadow-md shadow-charcoal-950/15"
                      : "text-charcoal-600/75 hover:bg-cream-50 hover:text-charcoal-600"
                  }`}
                >
                  {c.label}
                  <span className={`text-xs tabular-nums ${lit ? "text-cream-50/60" : "text-ink/35"}`}>
                    {c.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <ReorderCard variant="compact" className="mt-6" />

      {/* ---- results ------------------------------------------------------ */}
      <div aria-live="polite" className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink/60">{t("resultCount", { count })}</span>
        {filtering && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember-600 hover:text-ember-700"
          >
            <X size={14} aria-hidden="true" />
            {t("clearFilters")}
          </button>
        )}
        {!filtering && <SpiceLegend inline className="hidden md:flex" />}
      </div>

      {!filtering && popular.length > 0 && (
        <section aria-labelledby="menu-popular" className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <h2 id="menu-popular" className="flex items-center gap-2 font-display text-2xl font-semibold text-charcoal-600">
              <Flame size={22} aria-hidden="true" className="text-ember-600" />
              {t("popularTitle")}
            </h2>
            <span className="text-sm text-ink/50">{t("popularSub")}</span>
          </div>
          <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {popular.map((item) => (
              <div key={item.slug} className="w-[15rem] shrink-0 snap-start sm:w-[17rem] lg:w-auto">
                {card(item)}
              </div>
            ))}
          </div>
        </section>
      )}

      {count === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-charcoal-600/20 bg-cream-50/60 px-6 py-14 text-center">
          <Search size={28} aria-hidden="true" className="text-ink/30" />
          <p className="max-w-sm text-base text-ink/65">{t("noResults")}</p>
          <button
            type="button"
            onClick={clear}
            className="rounded-full bg-charcoal-600 px-6 py-3 font-display text-sm font-semibold text-cream-50 hover:bg-ember-600"
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {filtered.map((c) => (
            <section key={c.id} id={c.id} aria-labelledby={`h-${c.id}`} className="scroll-mt-48">
              <div className="flex items-end justify-between gap-3 border-b border-charcoal-600/10 pb-3">
                <div>
                  <h2 id={`h-${c.id}`} className="font-display text-2xl font-semibold text-charcoal-600 sm:text-[1.75rem]">
                    {c.label}
                  </h2>
                  {c.description && <p className="mt-1 text-sm text-ink/55">{c.description}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-cream-50 px-3 py-1 text-xs font-semibold tabular-nums text-charcoal-600/70 ring-1 ring-charcoal-600/8">
                  {t("resultCount", { count: c.items.length })}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {c.items.map(card)}
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
  if (item.description.toLowerCase().includes(q)) return true;
  return item.variants.some((v) => v.toLowerCase().includes(q));
}

/** The spice scale in one glance, so the chillies on the cards mean something. */
function SpiceLegend({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  const t = useTranslations("menu");
  return (
    <div className={`${inline ? "items-center gap-3" : ""} ${className}`}>
      <p
        className={`text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-charcoal-600/55 ${
          inline ? "" : "mb-3"
        }`}
      >
        {t("spiceScale")}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {[1, 2, 3].map((level) => (
          <li key={level}>
            <SpiceMeter level={level} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-300 ${
        active
          ? "border-ember-600 bg-ember-600 text-cream-50"
          : "border-charcoal-600/12 bg-cream-50 text-charcoal-600/80 hover:border-charcoal-600/35"
      }`}
    >
      {children}
    </button>
  );
}
